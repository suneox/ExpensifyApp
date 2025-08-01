import {getUnixTime} from 'date-fns';
import {deepEqual} from 'fast-equals';
import lodashClone from 'lodash/clone';
import lodashHas from 'lodash/has';
import type {OnyxCollection, OnyxEntry, OnyxUpdate} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import type {ChangeTransactionsReportParams, DismissViolationParams, GetRouteParams, MarkAsCashParams, TransactionThreadInfo} from '@libs/API/parameters';
import {READ_COMMANDS, WRITE_COMMANDS} from '@libs/API/types';
import * as CollectionUtils from '@libs/CollectionUtils';
import DateUtils from '@libs/DateUtils';
import * as NumberUtils from '@libs/NumberUtils';
import {rand64} from '@libs/NumberUtils';
import {hasDependentTags, isPaidGroupPolicy} from '@libs/PolicyUtils';
import {getAllReportActions, getIOUActionForReportID, getOriginalMessage, getTrackExpenseActionableWhisper, isModifiedExpenseAction} from '@libs/ReportActionsUtils';
import {
    buildOptimisticCreatedReportAction,
    buildOptimisticDismissedViolationReportAction,
    buildOptimisticMovedTransactionAction,
    buildOptimisticSelfDMReport,
    buildOptimisticUnreportedTransactionAction,
    buildTransactionThread,
    findSelfDMReportID,
} from '@libs/ReportUtils';
import {getAmount, waypointHasValidAddress} from '@libs/TransactionUtils';
import ViolationsUtils from '@libs/Violations/ViolationsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {PersonalDetails, Policy, RecentWaypoint, Report, ReportAction, ReviewDuplicates, Transaction, TransactionViolation, TransactionViolations} from '@src/types/onyx';
import type {OriginalMessageIOU, OriginalMessageModifiedExpense} from '@src/types/onyx/OriginalMessage';
import type {OnyxData} from '@src/types/onyx/Request';
import type {WaypointCollection} from '@src/types/onyx/Transaction';
import type TransactionState from '@src/types/utils/TransactionStateType';
import {getPolicyCategoriesData} from './Policy/Category';
import {getPolicyTagsData} from './Policy/Tag';

let recentWaypoints: RecentWaypoint[] = [];
Onyx.connect({
    key: ONYXKEYS.NVP_RECENT_WAYPOINTS,
    callback: (val) => (recentWaypoints = val ?? []),
});

let currentUserEmail = '';

Onyx.connect({
    key: ONYXKEYS.SESSION,
    callback: (value) => {
        currentUserEmail = value?.email ?? '';
    },
});

const allTransactions: Record<string, Transaction> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION,
    callback: (transaction, key) => {
        if (!key || !transaction) {
            return;
        }
        const transactionID = CollectionUtils.extractCollectionItemID(key);
        allTransactions[transactionID] = transaction;
    },
});

let allTransactionDrafts: OnyxCollection<Transaction> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION_DRAFT,
    waitForCollectionCallback: true,
    callback: (value) => {
        allTransactionDrafts = value ?? {};
    },
});

let allReports: OnyxCollection<Report> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT,
    waitForCollectionCallback: true,
    callback: (value) => {
        if (!value) {
            return;
        }
        allReports = value;
    },
});

const allTransactionViolation: OnyxCollection<TransactionViolation[]> = {};
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
    callback: (transactionViolation, key) => {
        if (!key || !transactionViolation) {
            return;
        }
        const transactionID = CollectionUtils.extractCollectionItemID(key);
        allTransactionViolation[transactionID] = transactionViolation;
    },
});

let allTransactionViolations: TransactionViolations = [];
Onyx.connect({
    key: ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS,
    callback: (val) => (allTransactionViolations = val ?? []),
});

function saveWaypoint(transactionID: string, index: string, waypoint: RecentWaypoint | null, isDraft = false) {
    Onyx.merge(`${isDraft ? ONYXKEYS.COLLECTION.TRANSACTION_DRAFT : ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, {
        comment: {
            waypoints: {
                [`waypoint${index}`]: waypoint,
            },
            customUnit: {
                quantity: null,
            },
        },
        // We want to reset the amount only for draft transactions (when creating the expense).
        // When modifying an existing transaction, the amount will be updated on the actual IOU update operation.
        ...(isDraft && {amount: CONST.IOU.DEFAULT_AMOUNT}),
        // Empty out errors when we're saving a new waypoint as this indicates the user is updating their input
        errorFields: {
            route: null,
        },

        // Clear the existing route so that we don't show an old route
        routes: {
            route0: {
                // Clear the existing distance to recalculate next time
                distance: null,
                geometry: {
                    coordinates: null,
                },
            },
        },
    });

    // You can save offline waypoints without verifying the address (we will geocode it on the backend)
    // We're going to prevent saving those addresses in the recent waypoints though since they could be invalid addresses
    // However, in the backend once we verify the address, we will save the waypoint in the recent waypoints NVP
    if (!lodashHas(waypoint, 'lat') || !lodashHas(waypoint, 'lng')) {
        return;
    }

    // If current location is used, we would want to avoid saving it as a recent waypoint. This prevents the 'Your Location'
    // text from showing up in the address search suggestions
    if (deepEqual(waypoint?.address, CONST.YOUR_LOCATION_TEXT)) {
        return;
    }
    const recentWaypointAlreadyExists = recentWaypoints.find((recentWaypoint) => recentWaypoint?.address === waypoint?.address);
    if (!recentWaypointAlreadyExists && waypoint !== null) {
        const clonedWaypoints = lodashClone(recentWaypoints);
        const updatedWaypoint = {...waypoint, pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD};
        clonedWaypoints.unshift(updatedWaypoint);
        Onyx.merge(ONYXKEYS.NVP_RECENT_WAYPOINTS, clonedWaypoints.slice(0, CONST.RECENT_WAYPOINTS_NUMBER));
    }
}

function removeWaypoint(transaction: OnyxEntry<Transaction>, currentIndex: string, isDraft?: boolean): Promise<void | void[]> {
    // Index comes from the route params and is a string
    const index = Number(currentIndex);
    if (index === -1) {
        return Promise.resolve();
    }
    const existingWaypoints = transaction?.comment?.waypoints ?? {};
    const totalWaypoints = Object.keys(existingWaypoints).length;

    const waypointValues = Object.values(existingWaypoints);
    const removed = waypointValues.splice(index, 1);
    if (removed.length === 0) {
        return Promise.resolve();
    }

    const isRemovedWaypointEmpty = removed.length > 0 && !waypointHasValidAddress(removed.at(0) ?? {});

    // When there are only two waypoints we are adding empty waypoint back
    if (totalWaypoints === 2 && (index === 0 || index === totalWaypoints - 1)) {
        waypointValues.splice(index, 0, {});
    }

    const reIndexedWaypoints: WaypointCollection = {};
    waypointValues.forEach((waypoint, idx) => {
        reIndexedWaypoints[`waypoint${idx}`] = waypoint;
    });

    // Onyx.merge won't remove the null nested object values, this is a workaround
    // to remove nested keys while also preserving other object keys
    // Doing a deep clone of the transaction to avoid mutating the original object and running into a cache issue when using Onyx.set
    let newTransaction: Transaction = {
        // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
        ...(transaction as Transaction),
        comment: {
            ...transaction?.comment,
            waypoints: reIndexedWaypoints,
            customUnit: {
                ...transaction?.comment?.customUnit,
                quantity: null,
            },
        },
        // We want to reset the amount only for draft transactions (when creating the expense).
        // When modifying an existing transaction, the amount will be updated on the actual IOU update operation.
        ...(isDraft && {amount: CONST.IOU.DEFAULT_AMOUNT}),
    };

    if (!isRemovedWaypointEmpty) {
        newTransaction = {
            ...newTransaction,
            // Clear any errors that may be present, which apply to the old route
            errorFields: {
                route: null,
            },
            // Clear the existing route so that we don't show an old route
            routes: {
                route0: {
                    // Clear the existing distance to recalculate next time
                    distance: null,
                    geometry: {
                        coordinates: null,
                    },
                },
            },
        };
    }
    if (isDraft) {
        return Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${transaction?.transactionID}`, newTransaction);
    }
    return Onyx.set(`${ONYXKEYS.COLLECTION.TRANSACTION}${transaction?.transactionID}`, newTransaction);
}

function getOnyxDataForRouteRequest(transactionID: string, transactionState: TransactionState = CONST.TRANSACTION.STATE.CURRENT): OnyxData {
    let keyPrefix;
    switch (transactionState) {
        case CONST.TRANSACTION.STATE.DRAFT:
            keyPrefix = ONYXKEYS.COLLECTION.TRANSACTION_DRAFT;
            break;
        case CONST.TRANSACTION.STATE.BACKUP:
            keyPrefix = ONYXKEYS.COLLECTION.TRANSACTION_BACKUP;
            break;
        case CONST.TRANSACTION.STATE.CURRENT:
        default:
            keyPrefix = ONYXKEYS.COLLECTION.TRANSACTION;
            break;
    }

    return {
        optimisticData: [
            {
                // Clears any potentially stale error messages from fetching the route
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${keyPrefix}${transactionID}`,
                value: {
                    comment: {
                        isLoading: true,
                    },
                    errorFields: {
                        route: null,
                    },
                },
            },
        ],
        // The route and failure are sent back via pusher in the BE, we are just clearing the loading state here
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${keyPrefix}${transactionID}`,
                value: {
                    comment: {
                        isLoading: false,
                    },
                    // When the user opens the distance request editor and changes the connection from offline to online,
                    // the transaction's pendingFields and pendingAction will be removed, but not transactionBackup.
                    // We clear the pendingFields and pendingAction for the backup here to ensure consistency with the transaction.
                    // Without this, the map will not be clickable if the user dismisses the distance request editor without saving.
                    ...(transactionState === CONST.TRANSACTION.STATE.BACKUP && {
                        pendingFields: {waypoints: null},
                        pendingAction: null,
                    }),
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${keyPrefix}${transactionID}`,
                value: {
                    comment: {
                        isLoading: false,
                    },
                },
            },
        ],
    };
}

/**
 * Sanitizes the waypoints by removing the pendingAction property.
 *
 * @param waypoints - The collection of waypoints to sanitize.
 * @returns The sanitized collection of waypoints.
 */
function sanitizeRecentWaypoints(waypoints: WaypointCollection): WaypointCollection {
    return Object.entries(waypoints).reduce((acc: WaypointCollection, [key, waypoint]) => {
        if ('pendingAction' in waypoint) {
            const {pendingAction, ...rest} = waypoint;
            acc[key] = rest;
        } else {
            acc[key] = waypoint;
        }
        return acc;
    }, {});
}

/**
 * Gets the route for a set of waypoints
 * Used so we can generate a map view of the provided waypoints
 */

function getRoute(transactionID: string, waypoints: WaypointCollection, routeType: TransactionState = CONST.TRANSACTION.STATE.CURRENT) {
    const parameters: GetRouteParams = {
        transactionID,
        waypoints: JSON.stringify(sanitizeRecentWaypoints(waypoints)),
    };

    let command;
    switch (routeType) {
        case CONST.TRANSACTION.STATE.DRAFT:
            command = READ_COMMANDS.GET_ROUTE_FOR_DRAFT;
            break;
        case CONST.TRANSACTION.STATE.CURRENT:
            command = READ_COMMANDS.GET_ROUTE;
            break;
        case CONST.TRANSACTION.STATE.BACKUP:
            command = READ_COMMANDS.GET_ROUTE_FOR_BACKUP;
            break;
        default:
            throw new Error('Invalid route type');
    }

    API.read(command, parameters, getOnyxDataForRouteRequest(transactionID, routeType));
}
/**
 * Updates all waypoints stored in the transaction specified by the provided transactionID.
 *
 * @param transactionID - The ID of the transaction to be updated
 * @param waypoints - An object containing all the waypoints
 *                             which will replace the existing ones.
 */
function updateWaypoints(transactionID: string, waypoints: WaypointCollection, isDraft = false): Promise<void | void[]> {
    return Onyx.merge(`${isDraft ? ONYXKEYS.COLLECTION.TRANSACTION_DRAFT : ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, {
        comment: {
            waypoints,
            customUnit: {
                quantity: null,
            },
        },
        // We want to reset the amount only for draft transactions (when creating the expense).
        // When modifying an existing transaction, the amount will be updated on the actual IOU update operation.
        ...(isDraft && {amount: CONST.IOU.DEFAULT_AMOUNT}),
        // Empty out errors when we're saving new waypoints as this indicates the user is updating their input
        errorFields: {
            route: null,
        },

        // Clear the existing route so that we don't show an old route
        routes: {
            route0: {
                // Clear the existing distance to recalculate next time
                distance: null,
                geometry: {
                    coordinates: null,
                },
            },
        },
    });
}

/**
 * Dismisses the duplicate transaction violation for the provided transactionIDs
 * and updates the transaction to include the dismissed violation in the comment.
 */
function dismissDuplicateTransactionViolation(transactionIDs: string[], dismissedPersonalDetails: PersonalDetails) {
    const currentTransactionViolations = transactionIDs.map((id) => ({transactionID: id, violations: allTransactionViolation?.[id] ?? []}));
    const currentTransactions = transactionIDs.map((id) => allTransactions?.[id]);
    const transactionsReportActions = currentTransactions.map((transaction) => getIOUActionForReportID(transaction.reportID, transaction.transactionID));
    const optimisticDismissedViolationReportActions = transactionsReportActions.map(() => {
        return buildOptimisticDismissedViolationReportAction({reason: 'manual', violationName: CONST.VIOLATIONS.DUPLICATED_TRANSACTION});
    });

    const optimisticData: OnyxUpdate[] = [];
    const failureData: OnyxUpdate[] = [];

    const optimisticReportActions: OnyxUpdate[] = transactionsReportActions.map((action, index) => {
        const optimisticDismissedViolationReportAction = optimisticDismissedViolationReportActions.at(index);
        return {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${action?.childReportID}`,
            value: optimisticDismissedViolationReportAction
                ? {
                      [optimisticDismissedViolationReportAction.reportActionID]: optimisticDismissedViolationReportAction as ReportAction,
                  }
                : undefined,
        };
    });
    const optimisticDataTransactionViolations: OnyxUpdate[] = currentTransactionViolations.map((transactionViolations) => ({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionViolations.transactionID}`,
        value: transactionViolations.violations?.filter((violation) => violation.name !== CONST.VIOLATIONS.DUPLICATED_TRANSACTION),
    }));

    optimisticData.push(...optimisticDataTransactionViolations);
    optimisticData.push(...optimisticReportActions);

    const optimisticDataTransactions: OnyxUpdate[] = currentTransactions.map((transaction) => ({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`,
        value: {
            ...transaction,
            comment: {
                ...transaction.comment,
                dismissedViolations: {
                    duplicatedTransaction: {
                        [dismissedPersonalDetails.login ?? '']: getUnixTime(new Date()),
                    },
                },
            },
        },
    }));

    optimisticData.push(...optimisticDataTransactions);

    const failureDataTransactionViolations: OnyxUpdate[] = currentTransactionViolations.map((transactionViolations) => ({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionViolations.transactionID}`,
        value: transactionViolations.violations?.map((violation) => violation),
    }));

    const failureDataTransaction: OnyxUpdate[] = currentTransactions.map((transaction) => ({
        onyxMethod: Onyx.METHOD.MERGE,
        key: `${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`,
        value: {
            ...transaction,
        },
    }));

    const failureReportActions: OnyxUpdate[] = transactionsReportActions.map((action, index) => {
        const optimisticDismissedViolationReportAction = optimisticDismissedViolationReportActions.at(index);
        return {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${action?.childReportID}`,
            value: optimisticDismissedViolationReportAction
                ? {
                      [optimisticDismissedViolationReportAction.reportActionID]: null,
                  }
                : undefined,
        };
    });

    failureData.push(...failureDataTransactionViolations);
    failureData.push(...failureDataTransaction);
    failureData.push(...failureReportActions);

    const successData: OnyxUpdate[] = transactionsReportActions.map((action, index) => {
        const optimisticDismissedViolationReportAction = optimisticDismissedViolationReportActions.at(index);
        return {
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${action?.childReportID}`,
            value: optimisticDismissedViolationReportAction
                ? {
                      [optimisticDismissedViolationReportAction.reportActionID]: null,
                  }
                : undefined,
        };
    });
    // We are creating duplicate resolved report actions for each duplicate transactions and all the report actions
    // should be correctly linked with their parent report but the BE is sometimes linking report actions to different
    // parent reports than the one we set optimistically, resulting in duplicate report actions. Therefore, we send the BE
    // random report action ids and onSuccessData we reset the report actions we added optimistically to avoid duplicate actions.
    const params: DismissViolationParams = {
        name: CONST.VIOLATIONS.DUPLICATED_TRANSACTION,
        transactionIDList: transactionIDs.join(','),
        reportActionIDList: optimisticDismissedViolationReportActions.map(() => NumberUtils.rand64()).join(','),
    };

    API.write(WRITE_COMMANDS.DISMISS_VIOLATION, params, {
        optimisticData,
        successData,
        failureData,
    });
}

function setReviewDuplicatesKey(values: Partial<ReviewDuplicates>) {
    Onyx.merge(`${ONYXKEYS.REVIEW_DUPLICATES}`, {
        ...values,
    });
}

function abandonReviewDuplicateTransactions() {
    Onyx.set(ONYXKEYS.REVIEW_DUPLICATES, null);
}

function clearError(transactionID: string) {
    Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, {errors: null, errorFields: {route: null, waypoints: null, routes: null}});
}

function getLastModifiedExpense(reportID?: string): OriginalMessageModifiedExpense | undefined {
    const modifiedExpenseActions = Object.values(getAllReportActions(reportID)).filter(isModifiedExpenseAction);
    modifiedExpenseActions.sort((a, b) => Number(a.reportActionID) - Number(b.reportActionID));
    return getOriginalMessage(modifiedExpenseActions.at(-1));
}

function revert(transaction?: OnyxEntry<Transaction>, originalMessage?: OriginalMessageModifiedExpense | undefined) {
    if (!transaction || !originalMessage?.oldAmount || !originalMessage.oldCurrency || !('amount' in originalMessage) || !('currency' in originalMessage)) {
        return;
    }

    Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`, {
        modifiedAmount: transaction?.amount && transaction?.amount < 0 ? -Math.abs(originalMessage.oldAmount) : originalMessage.oldAmount,
        modifiedCurrency: originalMessage.oldCurrency,
    });
}

function markAsCash(transactionID: string | undefined, transactionThreadReportID: string | undefined) {
    if (!transactionID || !transactionThreadReportID) {
        return;
    }
    const optimisticReportAction = buildOptimisticDismissedViolationReportAction({
        reason: 'manual',
        violationName: CONST.VIOLATIONS.RTER,
    });
    const optimisticReportActions = {
        [optimisticReportAction.reportActionID]: optimisticReportAction,
    };
    const onyxData: OnyxData = {
        optimisticData: [
            // Optimistically dismissing the violation, removing it from the list of violations
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionID}`,
                value: allTransactionViolations.filter((violation: TransactionViolation) => violation.name !== CONST.VIOLATIONS.RTER),
            },
            // Optimistically adding the system message indicating we dismissed the violation
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`,
                value: optimisticReportActions,
            },
        ],
        failureData: [
            // Rolling back the dismissal of the violation
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionID}`,
                value: allTransactionViolations,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`,
                value: {
                    [optimisticReportAction.reportActionID]: null,
                },
            },
        ],
    };

    const parameters: MarkAsCashParams = {
        transactionID,
        reportActionID: optimisticReportAction.reportActionID,
    };

    return API.write(WRITE_COMMANDS.MARK_AS_CASH, parameters, onyxData);
}

function openDraftDistanceExpense() {
    const onyxData: OnyxData = {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.SET,
                key: ONYXKEYS.NVP_RECENT_WAYPOINTS,

                // By optimistically setting the recent waypoints to an empty array, no further loading attempts will be made
                value: [],
            },
        ],
    };
    API.read(READ_COMMANDS.OPEN_DRAFT_DISTANCE_EXPENSE, null, onyxData);
}

function getRecentWaypoints() {
    return recentWaypoints;
}

function getAllTransactionViolationsLength() {
    return allTransactionViolations.length;
}

function getAllTransactions() {
    return Object.keys(allTransactions ?? {}).length;
}

/**
 * Returns a client generated 16 character hexadecimal value for the transactionID
 */
function generateTransactionID(): string {
    return NumberUtils.generateHexadecimalValue(16);
}

function setTransactionReport(transactionID: string, transaction: Partial<Transaction>, isDraft: boolean) {
    Onyx.merge(`${isDraft ? ONYXKEYS.COLLECTION.TRANSACTION_DRAFT : ONYXKEYS.COLLECTION.TRANSACTION}${transactionID}`, transaction);
}

function changeTransactionsReport(transactionIDs: string[], reportID: string, policy?: OnyxEntry<Policy>) {
    const newReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];

    const transactions = transactionIDs.map((id) => allTransactions?.[id]).filter((t): t is NonNullable<typeof t> => t !== undefined);
    const transactionIDToReportActionAndThreadData: Record<string, TransactionThreadInfo> = {};
    const updatedReportTotals: Record<string, number> = {};

    // Store current violations for each transaction to restore on failure
    const currentTransactionViolations: Record<string, TransactionViolation[]> = {};
    transactionIDs.forEach((id) => {
        currentTransactionViolations[id] = allTransactionViolation?.[id] ?? [];
    });

    const optimisticData: OnyxUpdate[] = [];
    const failureData: OnyxUpdate[] = [];
    const successData: OnyxUpdate[] = [];

    const existingSelfDMReportID = findSelfDMReportID();
    let selfDMReport: Report;
    let selfDMCreatedReportAction: ReportAction;

    if (!existingSelfDMReportID && reportID === CONST.REPORT.UNREPORTED_REPORT_ID) {
        const currentTime = DateUtils.getDBTime();
        selfDMReport = buildOptimisticSelfDMReport(currentTime);
        selfDMCreatedReportAction = buildOptimisticCreatedReportAction(currentUserEmail ?? '', currentTime);

        // Add optimistic updates for self DM report
        optimisticData.push(
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT}${selfDMReport.reportID}`,
                value: {
                    ...selfDMReport,
                    pendingFields: {
                        createChat: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
                    },
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${selfDMReport.reportID}`,
                value: {isOptimisticReport: true},
            },
            {
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${selfDMReport.reportID}`,
                value: {
                    [selfDMCreatedReportAction.reportActionID]: selfDMCreatedReportAction,
                },
            },
        );

        // Add success data for self DM report
        successData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${selfDMReport.reportID}`,
                value: {
                    pendingFields: {
                        createChat: null,
                    },
                },
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${selfDMReport.reportID}`,
                value: {isOptimisticReport: false},
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${selfDMReport.reportID}`,
                value: {
                    [selfDMCreatedReportAction.reportActionID]: {
                        pendingAction: null,
                    },
                },
            },
        );
        // Add failure data for self DM report
        failureData.push(
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${selfDMReport.reportID}`,
                value: null,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_METADATA}${selfDMReport.reportID}`,
                value: null,
            },
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${selfDMReport.reportID}`,
                value: null,
            },
        );
    }

    let transactionsMoved = false;

    transactions.forEach((transaction) => {
        const isUnreportedExpense = !transaction.reportID || transaction.reportID === CONST.REPORT.UNREPORTED_REPORT_ID;

        const selfDMReportID = existingSelfDMReportID ?? selfDMReport?.reportID;

        const oldIOUAction = getIOUActionForReportID(isUnreportedExpense ? selfDMReportID : transaction.reportID, transaction.transactionID);
        if (!transaction.reportID || transaction.reportID === reportID) {
            return;
        }

        transactionsMoved = true;

        const oldReportID = transaction.reportID;
        const oldReport = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${oldReportID}`];

        // 1. Optimistically change the reportID on the passed transactions
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`,
            value: {
                reportID,
            },
        });

        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`,
            value: {
                reportID,
            },
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.TRANSACTION}${transaction.transactionID}`,
            value: {
                reportID: transaction.reportID,
            },
        });

        // Optimistically clear all violations for the transaction when moving to self DM report
        if (reportID === CONST.REPORT.UNREPORTED_REPORT_ID) {
            const duplicateViolation = currentTransactionViolations?.[transaction.transactionID]?.find((violation) => violation.name === CONST.VIOLATIONS.DUPLICATED_TRANSACTION);
            const duplicateTransactionIDs = duplicateViolation?.data?.duplicates;
            if (duplicateTransactionIDs) {
                duplicateTransactionIDs.forEach((id) => {
                    optimisticData.push({
                        onyxMethod: Onyx.METHOD.SET,
                        key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${id}`,
                        value: allTransactionViolations.filter((violation: TransactionViolation) => violation.name !== CONST.VIOLATIONS.DUPLICATED_TRANSACTION),
                    });
                });
            }
            optimisticData.push({
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
                value: null,
            });

            successData.push({
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
                value: null,
            });

            failureData.push({
                onyxMethod: Onyx.METHOD.SET,
                key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
                value: currentTransactionViolations[transaction.transactionID],
            });
        }

        // 2. Calculate transaction violations if moving transaction to a workspace
        if (isPaidGroupPolicy(policy) && policy?.id) {
            const policyTagList = getPolicyTagsData(policy.id);
            const violationData = ViolationsUtils.getViolationsOnyxData(
                transaction,
                allTransactionViolations,
                policy,
                policyTagList,
                getPolicyCategoriesData(policy.id),
                hasDependentTags(policy, policyTagList),
                false,
            );
            optimisticData.push(violationData);
            failureData.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transaction.transactionID}`,
                value: allTransactionViolation?.[transaction.transactionID],
            });
        }

        // 3. Keep track of the new report totals
        const isUnreported = reportID === CONST.REPORT.UNREPORTED_REPORT_ID;
        const targetReportID = isUnreported ? selfDMReportID : reportID;
        const transactionAmount = getAmount(transaction);

        if (oldReport) {
            updatedReportTotals[oldReportID] = (updatedReportTotals[oldReportID] ? updatedReportTotals[oldReportID] : (oldReport?.total ?? 0)) + transactionAmount;
        }
        if (reportID && newReport) {
            updatedReportTotals[targetReportID] = (updatedReportTotals[targetReportID] ? updatedReportTotals[targetReportID] : (newReport.total ?? 0)) - transactionAmount;
        }

        // 4. Optimistically update the IOU action reportID
        const optimisticMoneyRequestReportActionID = rand64();

        const originalMessage = getOriginalMessage(oldIOUAction) as OriginalMessageIOU;
        const newIOUAction = {
            ...oldIOUAction,
            originalMessage: {
                ...originalMessage,
                IOUReportID: reportID,
                type: isUnreported ? CONST.IOU.REPORT_ACTION_TYPE.TRACK : CONST.IOU.REPORT_ACTION_TYPE.CREATE,
            },
            reportActionID: optimisticMoneyRequestReportActionID,
            pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
            actionName: oldIOUAction?.actionName ?? CONST.REPORT.ACTIONS.TYPE.MOVED_TRANSACTION,
            created: oldIOUAction?.created ?? DateUtils.getDBTime(),
        };

        const trackExpenseActionableWhisper = isUnreportedExpense ? getTrackExpenseActionableWhisper(transaction.transactionID, selfDMReportID) : undefined;

        if (oldIOUAction) {
            optimisticData.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetReportID}`,
                value: {
                    [newIOUAction.reportActionID]: newIOUAction,
                },
            });

            optimisticData.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${isUnreportedExpense ? selfDMReportID : oldReportID}`,
                value: {
                    [oldIOUAction.reportActionID]: {
                        previousMessage: oldIOUAction.message,
                        message: [
                            {
                                type: CONST.REPORT.MESSAGE.TYPE.COMMENT,
                                html: '',
                                text: '',
                                isEdited: true,
                                isDeletedParentAction: false,
                            },
                        ],
                        originalMessage: {
                            IOUTransactionID: null,
                        },
                        errors: undefined,
                    },
                    ...(trackExpenseActionableWhisper ? {[trackExpenseActionableWhisper.reportActionID]: null} : {}),
                },
            });
        }

        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetReportID}`,
            value: {
                [newIOUAction.reportActionID]: {pendingAction: null},
            },
        });
        if (oldIOUAction) {
            failureData.push(
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetReportID}`,
                    value: {
                        [newIOUAction.reportActionID]: null,
                    },
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${isUnreportedExpense ? selfDMReportID : oldReportID}`,
                    value: {
                        [oldIOUAction.reportActionID]: oldIOUAction,
                        ...(trackExpenseActionableWhisper ? {[trackExpenseActionableWhisper.reportActionID]: trackExpenseActionableWhisper} : {}),
                    },
                },
            );
        }

        // 5. Optimistically update the transaction thread and all threads in the transaction thread
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${newIOUAction.childReportID}`,
            value: {
                parentReportID: targetReportID,
                parentReportActionID: optimisticMoneyRequestReportActionID,
                policyID: reportID !== CONST.REPORT.UNREPORTED_REPORT_ID && newReport ? newReport.policyID : CONST.POLICY.ID_FAKE,
            },
        });

        if (oldIOUAction) {
            failureData.push({
                onyxMethod: Onyx.METHOD.MERGE,
                key: `${ONYXKEYS.COLLECTION.REPORT}${oldIOUAction.childReportID}`,
                value: {
                    parentReportID: isUnreportedExpense ? selfDMReportID : oldReportID,
                    optimisticMoneyRequestReportActionID: oldIOUAction.reportActionID,
                    policyID: allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${oldIOUAction.reportActionID}`]?.policyID,
                },
            });
        }

        // 6. (Optional) Create transactionThread if it doesn't exist
        let transactionThreadReportID = newIOUAction.childReportID;
        let transactionThreadCreatedReportActionID;
        if (!transactionThreadReportID) {
            const optimisticTransactionThread = buildTransactionThread(newIOUAction, reportID === CONST.REPORT.UNREPORTED_REPORT_ID ? undefined : newReport);
            const optimisticCreatedActionForTransactionThread = buildOptimisticCreatedReportAction(currentUserEmail);
            transactionThreadReportID = optimisticTransactionThread.reportID;
            transactionThreadCreatedReportActionID = optimisticCreatedActionForTransactionThread.reportActionID;
            newIOUAction.childReportID = transactionThreadReportID;

            optimisticData.push(
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT}${optimisticTransactionThread.reportID}`,
                    value: {...optimisticTransactionThread, pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD},
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${optimisticTransactionThread.reportID}`,
                    value: {[optimisticCreatedActionForTransactionThread.reportActionID]: optimisticCreatedActionForTransactionThread},
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetReportID}`,
                    value: {[newIOUAction.reportActionID]: {childReportID: optimisticTransactionThread.reportID}},
                },
            );

            successData.push(
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT}${optimisticTransactionThread.reportID}`,
                    value: {pendingAction: null},
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${optimisticTransactionThread.reportID}`,
                    value: {[optimisticCreatedActionForTransactionThread.reportActionID]: {pendingAction: null}},
                },
            );

            failureData.push(
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT}${optimisticTransactionThread.reportID}`,
                    value: null,
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${optimisticTransactionThread.reportID}`,
                    value: {[optimisticCreatedActionForTransactionThread.reportActionID]: null},
                },
                {
                    onyxMethod: Onyx.METHOD.MERGE,
                    key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${targetReportID}`,
                    value: {[newIOUAction.reportActionID]: {childReportID: null}},
                },
            );
        }

        // 7. Add MOVED_TRANSACTION or UNREPORTED_TRANSACTION report actions
        const movedAction =
            reportID === CONST.REPORT.UNREPORTED_REPORT_ID
                ? buildOptimisticUnreportedTransactionAction(transactionThreadReportID, oldReportID)
                : buildOptimisticMovedTransactionAction(transactionThreadReportID, reportID);

        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`,
            value: {[movedAction?.reportActionID]: movedAction},
        });

        successData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`,
            value: {[movedAction?.reportActionID]: {pendingAction: null}},
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`,
            value: {[movedAction?.reportActionID]: null},
        });

        // Create base transaction data object
        const baseTransactionData = {
            movedReportActionID: movedAction.reportActionID,
            moneyRequestPreviewReportActionID: newIOUAction.reportActionID,
            ...(oldIOUAction && !oldIOUAction.childReportID
                ? {
                      transactionThreadReportID,
                      transactionThreadCreatedReportActionID,
                  }
                : {}),
        };

        if (!existingSelfDMReportID && reportID === CONST.REPORT.UNREPORTED_REPORT_ID) {
            // Add self DM data to transaction data
            transactionIDToReportActionAndThreadData[transaction.transactionID] = {
                ...baseTransactionData,
                selfDMReportID: selfDMReport.reportID,
                selfDMCreatedReportActionID: selfDMCreatedReportAction.reportActionID,
            };
        } else {
            transactionIDToReportActionAndThreadData[transaction.transactionID] = baseTransactionData;
        }
    });

    if (!transactionsMoved) {
        return;
    }

    // 8. Update the report totals
    Object.entries(updatedReportTotals).forEach(([reportIDToUpdate, total]) => {
        optimisticData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${reportIDToUpdate}`,
            value: {total},
        });

        failureData.push({
            onyxMethod: Onyx.METHOD.MERGE,
            key: `${ONYXKEYS.COLLECTION.REPORT}${reportIDToUpdate}`,
            value: {total: allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${reportIDToUpdate}`]?.total},
        });
    });

    const parameters: ChangeTransactionsReportParams = {
        transactionList: transactionIDs.join(','),
        reportID,
        transactionIDToReportActionAndThreadData: JSON.stringify(transactionIDToReportActionAndThreadData),
    };

    API.write(WRITE_COMMANDS.CHANGE_TRANSACTIONS_REPORT, parameters, {
        optimisticData,
        successData,
        failureData,
    });
}

function getDraftTransactions(): Transaction[] {
    return Object.values(allTransactionDrafts ?? {}).filter((transaction): transaction is Transaction => !!transaction);
}

export {
    saveWaypoint,
    removeWaypoint,
    getRoute,
    updateWaypoints,
    clearError,
    markAsCash,
    dismissDuplicateTransactionViolation,
    getDraftTransactions,
    generateTransactionID,
    setReviewDuplicatesKey,
    abandonReviewDuplicateTransactions,
    openDraftDistanceExpense,
    getRecentWaypoints,
    sanitizeRecentWaypoints,
    getAllTransactionViolationsLength,
    getAllTransactions,
    getLastModifiedExpense,
    revert,
    changeTransactionsReport,
    setTransactionReport,
};

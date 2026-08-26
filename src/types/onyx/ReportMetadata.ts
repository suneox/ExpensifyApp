import type CONST from '@src/CONST';

import type {ValueOf} from 'type-fest';

import type * as OnyxCommon from './OnyxCommon';

/** The pending member of report */
type PendingChatMember = {
    /** Account ID of the pending member */
    accountID: string;

    /** Action to be applied to the pending member of report */
    pendingAction: OnyxCommon.PendingAction;

    /** Collection of errors to show to the user */
    errors?: OnyxCommon.Errors;
};

/** Per-report business state. Loading flags, pagination cursors, and last-visit timestamps
 *  are tracked in dedicated Onyx keys (RAM_ONLY_REPORT_LOADING_STATE, REPORT_PAGINATION_STATE,
 *  REPORT_LAST_VISIT_TIMES) and are NOT part of this type. */
type ReportMetadata = {
    /** Whether the current report is optimistic */
    isOptimisticReport?: boolean;

    /** Pending members of the report */
    pendingChatMembers?: PendingChatMember[];

    /** Whether the report has violations or errors */
    errors?: OnyxCommon.Errors;

    /** Pending expense action for DEW policies (e.g., SUBMIT or APPROVE in progress) */
    pendingExpenseAction?: ValueOf<typeof CONST.EXPENSE_PENDING_ACTION>;

    /** Transaction IDs that were just submitted/moved to this report and should be highlighted on first load */
    pendingNewTransactionIDs?: Record<string, true | null>;

    /**
     * An export to an accounting integration that this client started and that has no outcome on the report yet.
     *
     * `Report_Export` answers 200 as soon as the request is accepted and carries no `onyxData`, so there is no client
     * event meaning "the export finished" — the real outcome arrives later over Pusher. This marker is therefore
     * resolved at read time by comparing the report's own outcome fields against the snapshot taken when the export
     * started, rather than being cleared from a listener, so a stale marker can never strand the button.
     */
    pendingExport?: {
        /** `reportActionID` of the optimistic export action this attempt created */
        reportActionID: string;

        /** How many `errorFields.export` entries the report carried when this attempt started */
        errorCount: number;
    };
};

export default ReportMetadata;

export type {PendingChatMember};

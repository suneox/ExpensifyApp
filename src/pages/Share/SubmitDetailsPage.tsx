import type {StackScreenProps} from '@react-navigation/stack';
import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import type {FileObject} from '@components/AttachmentModal';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import LocationPermissionModal from '@components/LocationPermissionModal';
import MoneyRequestConfirmationList from '@components/MoneyRequestConfirmationList';
import ScreenWrapper from '@components/ScreenWrapper';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useFilesValidation from '@hooks/useFilesValidation';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';
import type {GpsPoint} from '@libs/actions/IOU';
import {getIOURequestPolicyID, getMoneyRequestParticipantsFromReport, initMoneyRequest, requestMoney, trackExpense, updateLastLocationPermissionPrompt} from '@libs/actions/IOU';
import DateUtils from '@libs/DateUtils';
import {getFileName, readFileAsync} from '@libs/fileDownload/FileUtils';
import getCurrentPosition from '@libs/getCurrentPosition';
import Log from '@libs/Log';
import navigateAfterInteraction from '@libs/Navigation/navigateAfterInteraction';
import Navigation from '@libs/Navigation/Navigation';
import type {ShareNavigatorParamList} from '@libs/Navigation/types';
import {getParticipantsOption, getReportOption} from '@libs/OptionsListUtils';
import {getReportOrDraftReport, isSelfDM} from '@libs/ReportUtils';
import {getDefaultTaxCode} from '@libs/TransactionUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type {Report as ReportType} from '@src/types/onyx';
import type {Participant} from '@src/types/onyx/IOU';
import type {Receipt} from '@src/types/onyx/Transaction';
import {showErrorAlert} from './ShareRootPage';

type ShareDetailsPageProps = StackScreenProps<ShareNavigatorParamList, typeof SCREENS.SHARE.SUBMIT_DETAILS>;
function SubmitDetailsPage({
    route: {
        params: {reportOrAccountID},
    },
}: ShareDetailsPageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [currentAttachment] = useOnyx(ONYXKEYS.SHARE_TEMP_FILE, {canBeMissing: true});
    const [unknownUserDetails] = useOnyx(ONYXKEYS.SHARE_UNKNOWN_USER_DETAILS, {canBeMissing: true});
    const [personalDetails] = useOnyx(`${ONYXKEYS.PERSONAL_DETAILS_LIST}`, {canBeMissing: true});
    const report: OnyxEntry<ReportType> = getReportOrDraftReport(reportOrAccountID);
    const [parentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report?.parentReportID}`, {canBeMissing: true});
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`, {canBeMissing: false});
    const [transaction] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION_DRAFT}${CONST.IOU.OPTIMISTIC_TRANSACTION_ID}`, {canBeMissing: true});
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${getIOURequestPolicyID(transaction, report)}`, {canBeMissing: false});
    const [policyTags] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${getIOURequestPolicyID(transaction, report)}`, {canBeMissing: false});
    const [lastLocationPermissionPrompt] = useOnyx(ONYXKEYS.NVP_LAST_LOCATION_PERMISSION_PROMPT, {canBeMissing: false});
    const [reportAttributesDerived] = useOnyx(ONYXKEYS.DERIVED.REPORT_ATTRIBUTES, {canBeMissing: true, selector: (val) => val?.reports});
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const [startLocationPermissionFlow, setStartLocationPermissionFlow] = useState(false);

    const [errorTitle, setErrorTitle] = useState<string | undefined>(undefined);
    const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

    const [validFilesToUpload, setValidFilesToUpload] = useState<FileObject[]>([]);
    const {validateFiles} = useFilesValidation(setValidFilesToUpload);

    useEffect(() => {
        if (!currentAttachment || validFilesToUpload.length !== 0) {
            return;
        }

        validateFiles([{name: currentAttachment.id, uri: currentAttachment.content, type: currentAttachment.mimeType}]);
    }, [currentAttachment, validFilesToUpload.length, validateFiles]);

    useEffect(() => {
        if (!errorTitle || !errorMessage) {
            return;
        }

        showErrorAlert(errorTitle, errorMessage);
    }, [errorTitle, errorMessage]);

    useEffect(() => {
        initMoneyRequest({
            reportID: reportOrAccountID,
            policy,
            currentIouRequestType: CONST.IOU.REQUEST_TYPE.SCAN,
            newIouRequestType: CONST.IOU.REQUEST_TYPE.SCAN,
            report,
            parentReport,
        });
    }, [reportOrAccountID, policy, report, parentReport]);

    const selectedParticipants = unknownUserDetails ? [unknownUserDetails] : getMoneyRequestParticipantsFromReport(report);
    const participants = selectedParticipants.map((participant) =>
        participant?.accountID ? getParticipantsOption(participant, personalDetails) : getReportOption(participant, reportAttributesDerived),
    );
    const trimmedComment = transaction?.comment?.comment?.trim() ?? '';
    const transactionAmount = transaction?.amount ?? 0;
    const transactionTaxAmount = transaction?.taxAmount ?? 0;
    const defaultTaxCode = getDefaultTaxCode(policy, transaction);
    const transactionTaxCode = (transaction?.taxCode ? transaction?.taxCode : defaultTaxCode) ?? '';

    const finishRequestAndNavigate = (participant: Participant, receipt: Receipt, gpsPoints?: GpsPoint) => {
        if (!transaction) {
            return;
        }

        if (isSelfDM(report)) {
            trackExpense({
                report: report ?? {reportID: reportOrAccountID},
                isDraftPolicy: false,
                participantParams: {payeeEmail: currentUserPersonalDetails.login, payeeAccountID: currentUserPersonalDetails.accountID, participant},
                policyParams: {policy, policyTagList: policyTags, policyCategories},
                action: CONST.IOU.TYPE.CREATE,
                transactionParams: {
                    amount: transactionAmount,
                    currency: transaction.currency,
                    comment: trimmedComment,
                    receipt,
                    category: transaction.category,
                    tag: transaction.tag,
                    taxCode: transactionTaxCode,
                    taxAmount: transactionTaxAmount,
                    billable: transaction.billable,
                    merchant: transaction.merchant ?? '',
                    created: transaction.created,
                    actionableWhisperReportActionID: transaction.actionableWhisperReportActionID,
                    linkedTrackedExpenseReportAction: transaction.linkedTrackedExpenseReportAction,
                    linkedTrackedExpenseReportID: transaction.linkedTrackedExpenseReportID,
                },
            });
        } else {
            requestMoney({
                report,
                participantParams: {payeeEmail: currentUserPersonalDetails.login, payeeAccountID: currentUserPersonalDetails.accountID, participant},
                policyParams: {policy, policyTagList: policyTags, policyCategories},
                gpsPoints,
                action: CONST.IOU.TYPE.CREATE,
                transactionParams: {
                    attendees: transaction.comment?.attendees,
                    amount: transactionAmount,
                    currency: transaction.currency,
                    comment: trimmedComment,
                    receipt,
                    category: transaction.category,
                    tag: transaction.tag,
                    taxCode: transactionTaxCode,
                    taxAmount: transactionTaxAmount,
                    billable: transaction.billable,
                    merchant: transaction.merchant ?? '',
                    created: transaction.created,
                    actionableWhisperReportActionID: transaction.actionableWhisperReportActionID,
                    linkedTrackedExpenseReportAction: transaction.linkedTrackedExpenseReportAction,
                    linkedTrackedExpenseReportID: transaction.linkedTrackedExpenseReportID,
                },
            });
        }
    };

    const onSuccess = (file: File, locationPermissionGranted?: boolean) => {
        const participant = selectedParticipants.at(0);
        if (!participant) {
            return;
        }

        const receipt: Receipt = file;
        receipt.state = file && CONST.IOU.RECEIPT_STATE.SCAN_READY;
        if (locationPermissionGranted) {
            getCurrentPosition(
                (successData) => {
                    finishRequestAndNavigate(participant, receipt, {
                        lat: successData.coords.latitude,
                        long: successData.coords.longitude,
                    });
                },
                (errorData) => {
                    Log.info('[SubmitDetailsPage] getCurrentPosition failed', false, errorData);
                    finishRequestAndNavigate(participant, receipt);
                },
                {
                    maximumAge: CONST.GPS.MAX_AGE,
                    timeout: CONST.GPS.TIMEOUT,
                },
            );
            return;
        }
        finishRequestAndNavigate(participant, receipt);
    };

    const onConfirm = (gpsRequired?: boolean) => {
        const shouldStartLocationPermissionFlow =
            gpsRequired &&
            (!lastLocationPermissionPrompt ||
                (DateUtils.isValidDateString(lastLocationPermissionPrompt ?? '') &&
                    DateUtils.getDifferenceInDaysFromNow(new Date(lastLocationPermissionPrompt ?? '')) > CONST.IOU.LOCATION_PERMISSION_PROMPT_THRESHOLD_DAYS));

        if (shouldStartLocationPermissionFlow) {
            setStartLocationPermissionFlow(true);
            return;
        }

        const validatedFile = validFilesToUpload.at(0);
        readFileAsync(
            validatedFile?.uri ?? '',
            getFileName(validatedFile?.name ?? 'shared_image.png'),
            (file) => onSuccess(file, shouldStartLocationPermissionFlow),
            () => {},
            validatedFile?.type ?? 'image/jpeg',
        );
    };

    return (
        <ScreenWrapper testID={SubmitDetailsPage.displayName}>
            <FullPageNotFoundView shouldShow={!reportOrAccountID}>
                <HeaderWithBackButton
                    title={translate('common.details')}
                    onBackButtonPress={() => Navigation.goBack()}
                />
                <LocationPermissionModal
                    startPermissionFlow={startLocationPermissionFlow}
                    resetPermissionFlow={() => setStartLocationPermissionFlow(false)}
                    onGrant={onConfirm}
                    onDeny={() => {
                        updateLastLocationPermissionPrompt();
                        setStartLocationPermissionFlow(false);
                        navigateAfterInteraction(() => {
                            onConfirm(false);
                        });
                    }}
                />
                <View style={[styles.containerWithSpaceBetween, styles.pointerEventsBoxNone]}>
                    <MoneyRequestConfirmationList
                        transaction={transaction}
                        selectedParticipants={participants}
                        iouAmount={0}
                        iouComment={trimmedComment}
                        iouCategory={transaction?.category}
                        onConfirm={() => onConfirm(true)}
                        receiptPath={validFilesToUpload.at(0)?.uri}
                        receiptFilename={getFileName(validFilesToUpload.at(0)?.name ?? '')}
                        reportID={reportOrAccountID}
                        shouldShowSmartScanFields={false}
                        isDistanceRequest={false}
                        onPDFLoadError={() => {
                            if (errorTitle) {
                                return;
                            }
                            setErrorTitle(translate('attachmentPicker.attachmentError'));
                            setErrorMessage(translate('attachmentPicker.errorWhileSelectingCorruptedAttachment'));
                        }}
                        onPDFPassword={() => {
                            if (errorTitle) {
                                return;
                            }
                            setErrorTitle(translate('attachmentPicker.attachmentError'));
                            setErrorMessage(translate('attachmentPicker.protectedPDFNotSupported'));
                        }}
                    />
                </View>
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

SubmitDetailsPage.displayName = 'SubmitDetailsPage';

export default SubmitDetailsPage;

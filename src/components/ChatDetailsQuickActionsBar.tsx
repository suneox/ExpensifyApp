import React, {useState} from 'react';
import {View} from 'react-native';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import * as Report from '@userActions/Report';
import type { Report as OnyxReportType, QuickAction as QuickActionType} from '@src/types/onyx';
import type { OnyxEntry} from 'react-native-onyx';
import { withOnyx } from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';
import Button from './Button';
import ConfirmModal from './ConfirmModal';
import * as Expensicons from './Icon/Expensicons';

type ChatDetailsQuickActionsBarOnyxProps = {
    /** Information on the last taken action to display as Quick Action */
    quickAction: OnyxEntry<QuickActionType>;
};

type ChatDetailsQuickActionsBarProps = ChatDetailsQuickActionsBarOnyxProps & {
    report: OnyxReportType;
};

function ChatDetailsQuickActionsBar({ report, quickAction }: ChatDetailsQuickActionsBarProps) {
    const styles = useThemeStyles();
    console.log(`___________ ChatDetailsQuickActionsBar ___________`,quickAction);
    const [isLastMemberLeavingGroupModalVisible, setIsLastMemberLeavingGroupModalVisible] = useState(false);
    const {translate} = useLocalize();
    const isPinned = !!report.isPinned;
    return (
        <View style={[styles.flexRow, styles.ph5, styles.mb5]}>
            <View style={[styles.flex1, styles.pr3]}>
                <ConfirmModal
                    danger
                    title={translate('groupChat.lastMemberTitle')}
                    isVisible={isLastMemberLeavingGroupModalVisible}
                    onConfirm={() => {
                        setIsLastMemberLeavingGroupModalVisible(false);
                        Report.leaveGroupChat(report.reportID, report.reportID === quickAction?.chatReportID);
                    }}
                    onCancel={() => setIsLastMemberLeavingGroupModalVisible(false)}
                    prompt={translate('groupChat.lastMemberWarning')}
                    confirmText={translate('common.leave')}
                    cancelText={translate('common.cancel')}
                />
                <Button
                    onPress={() => {
                        if (Object.keys(report?.participants ?? {}).length === 1) {
                            setIsLastMemberLeavingGroupModalVisible(true);
                            return;
                        }

                        Report.leaveGroupChat(report.reportID, report.reportID === quickAction?.chatReportID);
                    }}
                    icon={Expensicons.Exit}
                    style={styles.flex1}
                    text={translate('common.leave')}
                />
            </View>
            <View style={[styles.flex1]}>
                <Button
                    onPress={() => Report.togglePinnedState(report.reportID, isPinned)}
                    icon={Expensicons.Pin}
                    style={styles.flex1}
                    text={isPinned ? translate('common.unPin') : translate('common.pin')}
                />
            </View>
        </View>
    );
}

ChatDetailsQuickActionsBar.displayName = 'ChatDetailsQuickActionsBar';

export default withOnyx<ChatDetailsQuickActionsBarProps, ChatDetailsQuickActionsBarOnyxProps>({
    quickAction: {
        key: ONYXKEYS.NVP_QUICK_ACTION_GLOBAL_CREATE,
    },
})(ChatDetailsQuickActionsBar);

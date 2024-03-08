/* eslint-disable rulesdir/onyx-props-must-have-default */
import PropTypes from 'prop-types';
import React, {useCallback} from 'react';
import {View} from 'react-native';
import PressableWithoutFeedback from '@components/Pressable/PressableWithoutFeedback';
import Text from '@components/Text';
import Tooltip from '@components/Tooltip';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import PressableAvatarWithIndicator from './PressableAvatarWithIndicator';
import navigationRef from '../../../libs/Navigation/navigationRef';
import { getPathFromState } from '@react-navigation/native';

const propTypes = {
    /** Whether the create menu is open or not */
    isCreateMenuOpen: PropTypes.bool,

    /** Emoji status */
    emojiStatus: PropTypes.string,
};

const defaultProps = {
    isCreateMenuOpen: false,
    emojiStatus: '',
};

function AvatarWithOptionalStatus({emojiStatus, isCreateMenuOpen}) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const showStatusPage = useCallback(() => {
        if (isCreateMenuOpen) {
            // Prevent opening Settings page when click profile avatar quickly after clicking FAB icon
            return;
        }

        Navigation.setShouldPopAllStateOnUP();
        const activeRoute = Navigation.getActiveRoute();
        Navigation.navigate(ROUTES.SETTINGS_STATUS, undefined, {backTo: activeRoute});

        // const topmostReportId = Navigation.getTopmostReportId();
        // Navigation.navigate(ROUTES.SETTINGS_STATUS, undefined, {backTo: ROUTES.REPORT_WITH_ID.getRoute(topmostReportId)});

        // getPathFromState()
        // const currentRoute = navigationRef.current.getCurrentRoute();
        // console.log(`___________ currentRoute ___________`,currentRoute);
        // Navigation.navigate(ROUTES.SETTINGS_STATUS, undefined, {backTo: currentRoute.path});
    }, [isCreateMenuOpen]);

    return (
        <View style={styles.sidebarStatusAvatarContainer}>
            <PressableAvatarWithIndicator isCreateMenuOpen={isCreateMenuOpen} />
            <PressableWithoutFeedback
                accessibilityLabel={translate('sidebarScreen.buttonMySettings')}
                role={CONST.ROLE.BUTTON}
                onPress={showStatusPage}
                style={[styles.sidebarStatusAvatar]}
            >
                <Tooltip text={translate('statusPage.status')}>
                    <Text
                        style={styles.emojiStatusLHN}
                        numberOfLines={1}
                    >
                        {emojiStatus}
                    </Text>
                </Tooltip>
            </PressableWithoutFeedback>
        </View>
    );
}

AvatarWithOptionalStatus.propTypes = propTypes;
AvatarWithOptionalStatus.defaultProps = defaultProps;
AvatarWithOptionalStatus.displayName = 'AvatarWithOptionalStatus';
export default AvatarWithOptionalStatus;

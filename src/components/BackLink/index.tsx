import Icon from '@components/Icon';
import {PressableWithoutFeedback} from '@components/Pressable';
import Text from '@components/Text';

import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

import variables from '@styles/variables';

import type {StyleProp, ViewStyle} from 'react-native';

import React from 'react';

type BackLinkProps = {
    /** Called when the back link is pressed */
    onPress: () => void;

    /** Optional extra styles for the pressable row */
    style?: StyleProp<ViewStyle>;
};

/**
 * Popover-style back link: caret + "Back" label.
 * Matches the submenu back row used by PopoverMenu (components-popovermenu-v2--with-submenu).
 */
function BackLink({onPress, style}: BackLinkProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const theme = useTheme();
    const icons = useMemoizedLazyExpensifyIcons(['BackArrow']);

    return (
        <PressableWithoutFeedback
            onPress={onPress}
            style={[styles.flexRow, styles.alignItemsCenter, styles.pv3, {gap: 14, height: 52}, style]}
            accessibilityLabel={translate('common.back')}
        >
            <Icon
                src={icons.BackArrow}
                fill={theme.icon}
                width={variables.iconSizeNormal}
                height={variables.iconSizeNormal}
            />
            <Text style={styles.createMenuHeaderText}>{translate('common.back')}</Text>
        </PressableWithoutFeedback>
    );
}

export default BackLink;

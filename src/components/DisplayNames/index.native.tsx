import React from 'react';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import Parser from '@libs/Parser';
import StringUtils from '@libs/StringUtils';
import type DisplayNamesProps from './types';

// As we don't have to show tooltips of the Native platform so we simply render the full display names list.
function DisplayNames({accessibilityLabel, fullTitle, textStyles = [], numberOfLines = 1, renderAdditionalText}: DisplayNamesProps) {
    const {translate} = useLocalize();
    return (
        <Text
            accessibilityLabel={accessibilityLabel}
            style={textStyles}
            numberOfLines={numberOfLines}
            testID={DisplayNames.displayName}
        >
            {StringUtils.lineBreaksToSpaces(Parser.htmlToText(fullTitle)) || translate('common.hidden')}
            {renderAdditionalText?.()}
        </Text>
    );
}

DisplayNames.displayName = 'DisplayNames';

export default DisplayNames;

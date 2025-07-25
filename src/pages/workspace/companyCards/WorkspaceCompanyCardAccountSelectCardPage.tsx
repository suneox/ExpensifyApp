import React, {useCallback, useMemo, useState} from 'react';
import {View} from 'react-native';
import BlockingView from '@components/BlockingViews/BlockingView';
import {TeleScope} from '@components/Icon/Illustrations';
import RadioListItem from '@components/SelectionList/RadioListItem';
import SelectionScreen from '@components/SelectionScreen';
import type {SelectorType} from '@components/SelectionScreen';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import useCardFeeds from '@hooks/useCardFeeds';
import useCardsList from '@hooks/useCardsList';
import useLocalize from '@hooks/useLocalize';
import usePolicy from '@hooks/usePolicy';
import useThemeStyles from '@hooks/useThemeStyles';
import useWorkspaceAccountID from '@hooks/useWorkspaceAccountID';
import {setCompanyCardExportAccount} from '@libs/actions/CompanyCards';
import {getCompanyFeeds, getDomainOrWorkspaceAccountID} from '@libs/CardUtils';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import {getConnectedIntegration, getCurrentConnectionName} from '@libs/PolicyUtils';
import tokenizedSearch from '@libs/tokenizedSearch';
import Navigation from '@navigation/Navigation';
import type {SettingsNavigatorParamList} from '@navigation/types';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type {CompanyCardFeed} from '@src/types/onyx';
import {getExportMenuItem} from './utils';

type WorkspaceCompanyCardAccountSelectCardProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.COMPANY_CARD_EXPORT>;

function WorkspaceCompanyCardAccountSelectCardPage({route}: WorkspaceCompanyCardAccountSelectCardProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const {policyID, cardID, backTo} = route.params;
    const bank = decodeURIComponent(route.params.bank);
    const policy = usePolicy(policyID);
    const workspaceAccountID = useWorkspaceAccountID(policyID);
    const [searchText, setSearchText] = useState('');

    const [allBankCards] = useCardsList(policyID, bank as CompanyCardFeed);
    const card = allBankCards?.[cardID];
    const connectedIntegration = getConnectedIntegration(policy) ?? CONST.POLICY.CONNECTIONS.NAME.QBO;
    const exportMenuItem = getExportMenuItem(connectedIntegration, policyID, translate, policy, card, Navigation.getActiveRoute());
    const currentConnectionName = getCurrentConnectionName(policy);
    const shouldShowTextInput = (exportMenuItem?.data?.length ?? 0) >= CONST.STANDARD_LIST_ITEM_LIMIT;
    const defaultCard = translate('workspace.moreFeatures.companyCards.defaultCard');
    const isXeroConnection = connectedIntegration === CONST.POLICY.CONNECTIONS.NAME.XERO;

    const [cardFeeds] = useCardFeeds(policyID);
    const companyFeeds = getCompanyFeeds(cardFeeds);
    const domainOrWorkspaceAccountID = getDomainOrWorkspaceAccountID(workspaceAccountID, companyFeeds[bank as CompanyCardFeed]);

    const searchedListOptions = useMemo(() => {
        return tokenizedSearch(exportMenuItem?.data ?? [], searchText, (option) => [option.value]);
    }, [exportMenuItem?.data, searchText]);

    const listEmptyContent = useMemo(
        () => (
            <BlockingView
                icon={TeleScope}
                iconWidth={variables.emptyListIconWidth}
                iconHeight={variables.emptyListIconHeight}
                title={translate('workspace.moreFeatures.companyCards.noAccountsFound')}
                subtitle={currentConnectionName ? translate('workspace.moreFeatures.companyCards.noAccountsFoundDescription', {connection: currentConnectionName}) : undefined}
                containerStyle={styles.pb10}
            />
        ),
        [translate, currentConnectionName, styles],
    );

    const updateExportAccount = useCallback(
        ({value}: SelectorType) => {
            if (!exportMenuItem?.exportType) {
                return;
            }
            const isDefaultCardSelected = value === defaultCard;
            const exportValue = isDefaultCardSelected ? CONST.COMPANY_CARDS.DEFAULT_EXPORT_TYPE : value;
            setCompanyCardExportAccount(policyID, domainOrWorkspaceAccountID, cardID, exportMenuItem.exportType, exportValue, bank);

            Navigation.goBack(ROUTES.WORKSPACE_COMPANY_CARD_DETAILS.getRoute(policyID, cardID, bank));
        },
        [exportMenuItem?.exportType, domainOrWorkspaceAccountID, cardID, policyID, bank, defaultCard],
    );

    return (
        <SelectionScreen
            policyID={policyID}
            headerContent={
                <View style={[styles.mh5, styles.mb3]}>
                    {!!exportMenuItem?.description && (
                        <Text style={[styles.textNormal]}>
                            {translate('workspace.moreFeatures.companyCards.integrationExportTitleFirstPart', {integration: exportMenuItem.description})}{' '}
                            {!!exportMenuItem && !isXeroConnection && (
                                <>
                                    {translate('workspace.moreFeatures.companyCards.integrationExportTitlePart')}{' '}
                                    <TextLink
                                        style={styles.link}
                                        onPress={exportMenuItem.onExportPagePress}
                                    >
                                        {translate('workspace.moreFeatures.companyCards.integrationExportTitleLinkPart')}{' '}
                                    </TextLink>
                                    {translate('workspace.moreFeatures.companyCards.integrationExportTitleSecondPart')}
                                </>
                            )}
                        </Text>
                    )}
                </View>
            }
            featureName={CONST.POLICY.MORE_FEATURES.ARE_COMPANY_CARDS_ENABLED}
            displayName={WorkspaceCompanyCardAccountSelectCardPage.displayName}
            sections={[{data: searchedListOptions ?? []}]}
            listItem={RadioListItem}
            textInputLabel={translate('common.search')}
            textInputValue={searchText}
            onChangeText={setSearchText}
            onSelectRow={updateExportAccount}
            initiallyFocusedOptionKey={exportMenuItem?.data?.find((mode) => mode.isSelected)?.keyForList}
            onBackButtonPress={() => Navigation.goBack(ROUTES.WORKSPACE_COMPANY_CARD_DETAILS.getRoute(policyID, cardID, bank, backTo), {compareParams: false})}
            headerTitleAlreadyTranslated={exportMenuItem?.description}
            listEmptyContent={listEmptyContent}
            connectionName={connectedIntegration}
            shouldShowTextInput={shouldShowTextInput}
        />
    );
}

WorkspaceCompanyCardAccountSelectCardPage.displayName = 'WorkspaceCompanyCardAccountSelectCardPage';

export default WorkspaceCompanyCardAccountSelectCardPage;

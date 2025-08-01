import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, InteractionManager, View} from 'react-native';
import Button from '@components/Button';
import ButtonWithDropdownMenu from '@components/ButtonWithDropdownMenu';
import type {DropdownOption} from '@components/ButtonWithDropdownMenu/types';
import ConfirmModal from '@components/ConfirmModal';
import DecisionModal from '@components/DecisionModal';
import EmptyStateComponent from '@components/EmptyStateComponent';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import * as Expensicons from '@components/Icon/Expensicons';
import * as Illustrations from '@components/Icon/Illustrations';
import LottieAnimations from '@components/LottieAnimations';
import RenderHTML from '@components/RenderHTML';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import SearchBar from '@components/SearchBar';
import TableListItem from '@components/SelectionList/TableListItem';
import type {ListItem} from '@components/SelectionList/types';
import SelectionListWithModal from '@components/SelectionListWithModal';
import CustomListHeader from '@components/SelectionListWithModal/CustomListHeader';
import TableListItemSkeleton from '@components/Skeletons/TableRowSkeleton';
import Switch from '@components/Switch';
import Text from '@components/Text';
import TextLink from '@components/TextLink';
import useAutoTurnSelectionModeOffWhenHasNoActiveOption from '@hooks/useAutoTurnSelectionModeOffWhenHasNoActiveOption';
import useCleanupSelectedOptions from '@hooks/useCleanupSelectedOptions';
import useEnvironment from '@hooks/useEnvironment';
import useFilteredSelection from '@hooks/useFilteredSelection';
import useLocalize from '@hooks/useLocalize';
import useMobileSelectionMode from '@hooks/useMobileSelectionMode';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePolicy from '@hooks/usePolicy';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSearchBackPress from '@hooks/useSearchBackPress';
import useSearchResults from '@hooks/useSearchResults';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {isConnectionInProgress, isConnectionUnverified} from '@libs/actions/connections';
import {turnOffMobileSelectionMode} from '@libs/actions/MobileSelectionMode';
import {canUseTouchScreen} from '@libs/DeviceCapabilities';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {WorkspaceSplitNavigatorParamList} from '@libs/Navigation/types';
import {isDisablingOrDeletingLastEnabledCategory} from '@libs/OptionsListUtils';
import {getConnectedIntegration, getCurrentConnectionName, hasAccountingConnections, shouldShowSyncError} from '@libs/PolicyUtils';
import StringUtils from '@libs/StringUtils';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import {close} from '@userActions/Modal';
import {clearCategoryErrors, deleteWorkspaceCategories, downloadCategoriesCSV, openPolicyCategoriesPage, setWorkspaceCategoryEnabled} from '@userActions/Policy/Category';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type {PolicyCategory} from '@src/types/onyx';
import type DeepValueOf from '@src/types/utils/DeepValueOf';

type PolicyOption = ListItem & {
    /** Category name is used as a key for the selectedCategories state */
    keyForList: string;
};

type WorkspaceCategoriesPageProps =
    | PlatformStackScreenProps<WorkspaceSplitNavigatorParamList, typeof SCREENS.WORKSPACE.CATEGORIES>
    | PlatformStackScreenProps<WorkspaceSplitNavigatorParamList, typeof SCREENS.SETTINGS_CATEGORIES.SETTINGS_CATEGORIES_ROOT>;

function WorkspaceCategoriesPage({route}: WorkspaceCategoriesPageProps) {
    // We need to use isSmallScreenWidth instead of shouldUseNarrowLayout to apply the correct modal type for the decision modal
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {shouldUseNarrowLayout, isSmallScreenWidth} = useResponsiveLayout();
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate, localeCompare} = useLocalize();
    const [isOfflineModalVisible, setIsOfflineModalVisible] = useState(false);
    const [isDownloadFailureModalVisible, setIsDownloadFailureModalVisible] = useState(false);
    const [deleteCategoriesConfirmModalVisible, setDeleteCategoriesConfirmModalVisible] = useState(false);
    const [isCannotDeleteOrDisableLastCategoryModalVisible, setIsCannotDeleteOrDisableLastCategoryModalVisible] = useState(false);
    const {environmentURL} = useEnvironment();
    const policyId = route.params.policyID;
    const backTo = route.params?.backTo;
    const policy = usePolicy(policyId);
    const isMobileSelectionModeEnabled = useMobileSelectionMode();
    const [allTransactionViolations] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, {canBeMissing: true});
    const [policyTagLists] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_TAGS}${policyId}`, {canBeMissing: true});
    const [policyCategories] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CATEGORIES}${policyId}`, {canBeMissing: true});
    const [connectionSyncProgress] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY_CONNECTION_SYNC_PROGRESS}${policy?.id}`, {canBeMissing: true});
    const isSyncInProgress = isConnectionInProgress(connectionSyncProgress, policy);
    const hasSyncError = shouldShowSyncError(policy, isSyncInProgress);
    const connectedIntegration = getConnectedIntegration(policy) ?? connectionSyncProgress?.connectionName;
    const isConnectionVerified = connectedIntegration && !isConnectionUnverified(policy, connectedIntegration);
    const currentConnectionName = getCurrentConnectionName(policy);
    const isQuickSettingsFlow = route.name === SCREENS.SETTINGS_CATEGORIES.SETTINGS_CATEGORIES_ROOT;
    const filterCategories = useCallback((category: PolicyCategory | undefined) => !!category && category.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE, []);

    const [selectedCategories, setSelectedCategories] = useFilteredSelection(policyCategories, filterCategories);
    const canSelectMultiple = isSmallScreenWidth ? isMobileSelectionModeEnabled : true;

    const fetchCategories = useCallback(() => {
        openPolicyCategoriesPage(policyId);
    }, [policyId]);

    const {isOffline} = useNetwork({onReconnect: fetchCategories});

    useEffect(() => {
        fetchCategories();
        // eslint-disable-next-line react-compiler/react-compiler
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cleanupSelectedOption = useCallback(() => setSelectedCategories([]), [setSelectedCategories]);
    useCleanupSelectedOptions(cleanupSelectedOption);

    useSearchBackPress({
        onClearSelection: () => setSelectedCategories([]),
        onNavigationCallBack: () => Navigation.goBack(backTo),
    });

    const updateWorkspaceCategoryEnabled = useCallback(
        (value: boolean, categoryName: string) => {
            setWorkspaceCategoryEnabled(policyId, {[categoryName]: {name: categoryName, enabled: value}}, policyTagLists, allTransactionViolations);
        },
        [policyId, policyTagLists, allTransactionViolations],
    );

    const categoryList = useMemo<PolicyOption[]>(() => {
        const categories = Object.values(policyCategories ?? {});
        return categories.reduce<PolicyOption[]>((acc, value) => {
            const isDisabled = value.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;

            if (!isOffline && isDisabled) {
                return acc;
            }

            acc.push({
                text: value.name,
                keyForList: value.name,
                isDisabled,
                pendingAction: value.pendingAction,
                errors: value.errors ?? undefined,
                rightElement: (
                    <Switch
                        isOn={value.enabled}
                        disabled={isDisabled}
                        accessibilityLabel={translate('workspace.categories.enableCategory')}
                        onToggle={(newValue: boolean) => {
                            if (isDisablingOrDeletingLastEnabledCategory(policy, policyCategories, [value])) {
                                setIsCannotDeleteOrDisableLastCategoryModalVisible(true);
                                return;
                            }
                            updateWorkspaceCategoryEnabled(newValue, value.name);
                        }}
                        showLockIcon={isDisablingOrDeletingLastEnabledCategory(policy, policyCategories, [value])}
                    />
                ),
            });

            return acc;
        }, []);
    }, [policyCategories, isOffline, translate, updateWorkspaceCategoryEnabled, policy]);

    const filterCategory = useCallback((categoryOption: PolicyOption, searchInput: string) => {
        const categoryText = StringUtils.normalize(categoryOption.text?.toLowerCase() ?? '');
        const alternateText = StringUtils.normalize(categoryOption.alternateText?.toLowerCase() ?? '');
        const normalizedSearchInput = StringUtils.normalize(searchInput);
        return categoryText.includes(normalizedSearchInput) || alternateText.includes(normalizedSearchInput);
    }, []);
    const sortCategories = useCallback(
        (data: PolicyOption[]) => {
            return data.sort((a, b) => localeCompare(a.text ?? '', b?.text ?? ''));
        },
        [localeCompare],
    );
    const [inputValue, setInputValue, filteredCategoryList] = useSearchResults(categoryList, filterCategory, sortCategories);

    useAutoTurnSelectionModeOffWhenHasNoActiveOption(categoryList);

    const toggleCategory = useCallback(
        (category: PolicyOption) => {
            setSelectedCategories((prev) => {
                if (prev.includes(category.keyForList)) {
                    return prev.filter((key) => key !== category.keyForList);
                }
                return [...prev, category.keyForList];
            });
        },
        [setSelectedCategories],
    );

    const toggleAllCategories = () => {
        const availableCategories = filteredCategoryList.filter((category) => category.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
        const someSelected = availableCategories.some((category) => selectedCategories.includes(category.keyForList));
        setSelectedCategories(someSelected ? [] : availableCategories.map((item) => item.keyForList));
    };

    const getCustomListHeader = () => {
        if (filteredCategoryList.length === 0) {
            return null;
        }
        return (
            <CustomListHeader
                canSelectMultiple={canSelectMultiple}
                leftHeaderText={translate('common.name')}
                rightHeaderText={translate('common.enabled')}
            />
        );
    };

    const navigateToCategorySettings = (category: PolicyOption) => {
        if (isSmallScreenWidth && isMobileSelectionModeEnabled) {
            toggleCategory(category);
            return;
        }
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_CATEGORY_SETTINGS.getRoute(policyId, category.keyForList, backTo)
                : ROUTES.WORKSPACE_CATEGORY_SETTINGS.getRoute(policyId, category.keyForList),
        );
    };

    const navigateToCategoriesSettings = useCallback(() => {
        Navigation.navigate(isQuickSettingsFlow ? ROUTES.SETTINGS_CATEGORIES_SETTINGS.getRoute(policyId, backTo) : ROUTES.WORKSPACE_CATEGORIES_SETTINGS.getRoute(policyId));
    }, [isQuickSettingsFlow, policyId, backTo]);

    const navigateToCreateCategoryPage = () => {
        Navigation.navigate(isQuickSettingsFlow ? ROUTES.SETTINGS_CATEGORY_CREATE.getRoute(policyId, backTo) : ROUTES.WORKSPACE_CATEGORY_CREATE.getRoute(policyId));
    };

    const dismissError = (item: PolicyOption) => {
        clearCategoryErrors(policyId, item.keyForList);
    };

    const handleDeleteCategories = () => {
        deleteWorkspaceCategories(policyId, selectedCategories, policyTagLists, allTransactionViolations);
        setDeleteCategoriesConfirmModalVisible(false);

        InteractionManager.runAfterInteractions(() => {
            setSelectedCategories([]);
        });
    };
    const hasVisibleCategories = categoryList.some((category) => category.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || isOffline);

    const policyHasAccountingConnections = hasAccountingConnections(policy);

    const navigateToImportSpreadsheet = useCallback(() => {
        if (isOffline) {
            close(() => setIsOfflineModalVisible(true));
            return;
        }
        Navigation.navigate(
            isQuickSettingsFlow
                ? ROUTES.SETTINGS_CATEGORIES_IMPORT.getRoute(policyId, ROUTES.SETTINGS_CATEGORIES_ROOT.getRoute(policyId, backTo))
                : ROUTES.WORKSPACE_CATEGORIES_IMPORT.getRoute(policyId),
        );
    }, [backTo, isOffline, isQuickSettingsFlow, policyId]);

    const secondaryActions = useMemo(() => {
        const menuItems = [];
        menuItems.push({
            icon: Expensicons.Gear,
            text: translate('common.settings'),
            onSelected: navigateToCategoriesSettings,
            value: CONST.POLICY.SECONDARY_ACTIONS.SETTINGS,
        });
        if (!policyHasAccountingConnections) {
            menuItems.push({
                icon: Expensicons.Table,
                text: translate('spreadsheet.importSpreadsheet'),
                onSelected: navigateToImportSpreadsheet,
                value: CONST.POLICY.SECONDARY_ACTIONS.IMPORT_SPREADSHEET,
            });
        }
        if (hasVisibleCategories) {
            menuItems.push({
                icon: Expensicons.Download,
                text: translate('spreadsheet.downloadCSV'),
                onSelected: () => {
                    if (isOffline) {
                        close(() => setIsOfflineModalVisible(true));
                        return;
                    }
                    close(() => {
                        downloadCategoriesCSV(policyId, () => {
                            setIsDownloadFailureModalVisible(true);
                        });
                    });
                },
                value: CONST.POLICY.SECONDARY_ACTIONS.DOWNLOAD_CSV,
            });
        }

        return menuItems;
    }, [translate, navigateToCategoriesSettings, policyHasAccountingConnections, hasVisibleCategories, navigateToImportSpreadsheet, isOffline, policyId]);

    const getHeaderButtons = () => {
        const options: Array<DropdownOption<DeepValueOf<typeof CONST.POLICY.BULK_ACTION_TYPES>>> = [];
        const isThereAnyAccountingConnection = Object.keys(policy?.connections ?? {}).length !== 0;
        const selectedCategoriesObject = selectedCategories.map((key) => policyCategories?.[key]);

        if (isSmallScreenWidth ? canSelectMultiple : selectedCategories.length > 0) {
            if (!isThereAnyAccountingConnection) {
                options.push({
                    icon: Expensicons.Trashcan,
                    text: translate(selectedCategories.length === 1 ? 'workspace.categories.deleteCategory' : 'workspace.categories.deleteCategories'),
                    value: CONST.POLICY.BULK_ACTION_TYPES.DELETE,
                    onSelected: () => {
                        if (isDisablingOrDeletingLastEnabledCategory(policy, policyCategories, selectedCategoriesObject)) {
                            setIsCannotDeleteOrDisableLastCategoryModalVisible(true);
                            return;
                        }

                        setDeleteCategoriesConfirmModalVisible(true);
                    },
                });
            }

            const enabledCategories = selectedCategories.filter((categoryName) => policyCategories?.[categoryName]?.enabled);
            if (enabledCategories.length > 0) {
                const categoriesToDisable = selectedCategories
                    .filter((categoryName) => policyCategories?.[categoryName]?.enabled)
                    .reduce<Record<string, {name: string; enabled: boolean}>>((acc, categoryName) => {
                        acc[categoryName] = {
                            name: categoryName,
                            enabled: false,
                        };
                        return acc;
                    }, {});
                options.push({
                    icon: Expensicons.Close,
                    text: translate(enabledCategories.length === 1 ? 'workspace.categories.disableCategory' : 'workspace.categories.disableCategories'),
                    value: CONST.POLICY.BULK_ACTION_TYPES.DISABLE,
                    onSelected: () => {
                        if (isDisablingOrDeletingLastEnabledCategory(policy, policyCategories, selectedCategoriesObject)) {
                            setIsCannotDeleteOrDisableLastCategoryModalVisible(true);
                            return;
                        }
                        setSelectedCategories([]);
                        setWorkspaceCategoryEnabled(policyId, categoriesToDisable, policyTagLists, allTransactionViolations);
                    },
                });
            }

            const disabledCategories = selectedCategories.filter((categoryName) => !policyCategories?.[categoryName]?.enabled);
            if (disabledCategories.length > 0) {
                const categoriesToEnable = selectedCategories
                    .filter((categoryName) => !policyCategories?.[categoryName]?.enabled)
                    .reduce<Record<string, {name: string; enabled: boolean}>>((acc, categoryName) => {
                        acc[categoryName] = {
                            name: categoryName,
                            enabled: true,
                        };
                        return acc;
                    }, {});
                options.push({
                    icon: Expensicons.Checkmark,
                    text: translate(disabledCategories.length === 1 ? 'workspace.categories.enableCategory' : 'workspace.categories.enableCategories'),
                    value: CONST.POLICY.BULK_ACTION_TYPES.ENABLE,
                    onSelected: () => {
                        setSelectedCategories([]);
                        setWorkspaceCategoryEnabled(policyId, categoriesToEnable, policyTagLists, allTransactionViolations);
                    },
                });
            }

            return (
                <ButtonWithDropdownMenu
                    onPress={() => null}
                    shouldAlwaysShowDropdownMenu
                    buttonSize={CONST.DROPDOWN_BUTTON_SIZE.MEDIUM}
                    customText={translate('workspace.common.selected', {count: selectedCategories.length})}
                    options={options}
                    isSplitButton={false}
                    style={[shouldUseNarrowLayout && styles.flexGrow1, shouldUseNarrowLayout && styles.mb3]}
                    isDisabled={!selectedCategories.length}
                    testID={`${WorkspaceCategoriesPage.displayName}-header-dropdown-menu-button`}
                />
            );
        }
        const shouldShowAddCategory = !policyHasAccountingConnections && hasVisibleCategories;
        return (
            <View style={[styles.flexRow, styles.gap2, shouldUseNarrowLayout && styles.mb3]}>
                {shouldShowAddCategory && (
                    <Button
                        success
                        onPress={navigateToCreateCategoryPage}
                        icon={Expensicons.Plus}
                        text={translate('workspace.categories.addCategory')}
                        style={[shouldUseNarrowLayout && styles.flex1]}
                    />
                )}
                <ButtonWithDropdownMenu
                    success={false}
                    onPress={() => {}}
                    shouldAlwaysShowDropdownMenu
                    customText={translate('common.more')}
                    options={secondaryActions}
                    isSplitButton={false}
                    wrapperStyle={shouldShowAddCategory ? styles.flexGrow0 : styles.flexGrow1}
                />
            </View>
        );
    };

    const isLoading = !isOffline && policyCategories === undefined;

    useEffect(() => {
        if (isMobileSelectionModeEnabled) {
            return;
        }

        setSelectedCategories([]);
    }, [setSelectedCategories, isMobileSelectionModeEnabled]);

    const selectionModeHeader = isMobileSelectionModeEnabled && shouldUseNarrowLayout;

    const headerContent = (
        <>
            <View style={[styles.ph5, styles.pb5, styles.pt3, shouldUseNarrowLayout ? styles.workspaceSectionMobile : styles.workspaceSection]}>
                {!hasSyncError && isConnectionVerified ? (
                    <Text>
                        <Text style={[styles.textNormal, styles.colorMuted]}>{`${translate('workspace.categories.importedFromAccountingSoftware')} `}</Text>
                        <TextLink
                            style={[styles.textNormal, styles.link]}
                            href={`${environmentURL}/${ROUTES.POLICY_ACCOUNTING.getRoute(policyId)}`}
                        >
                            {`${currentConnectionName} ${translate('workspace.accounting.settings')}`}
                        </TextLink>
                        <Text style={[styles.textNormal, styles.colorMuted]}>.</Text>
                    </Text>
                ) : (
                    <Text style={[styles.textNormal, styles.colorMuted]}>{translate('workspace.categories.subtitle')}</Text>
                )}
            </View>
            {categoryList.length > CONST.SEARCH_ITEM_LIMIT && (
                <SearchBar
                    label={translate('workspace.categories.findCategory')}
                    inputValue={inputValue}
                    onChangeText={setInputValue}
                    shouldShowEmptyState={hasVisibleCategories && !isLoading && filteredCategoryList.length === 0}
                />
            )}
        </>
    );
    const subtitleText = useMemo(() => {
        if (!policyHasAccountingConnections) {
            return <Text style={[styles.textAlignCenter, styles.textSupporting, styles.textNormal]}>{translate('workspace.categories.emptyCategories.subtitle')}</Text>;
        }
        return (
            <View style={[styles.renderHTML]}>
                <RenderHTML
                    html={translate('workspace.categories.emptyCategories.subtitleWithAccounting', {
                        accountingPageURL: `${environmentURL}/${ROUTES.POLICY_ACCOUNTING.getRoute(policyId)}`,
                    })}
                />
            </View>
        );
    }, [policyHasAccountingConnections, styles.renderHTML, styles.textAlignCenter, styles.textSupporting, styles.textNormal, translate, environmentURL, policyId]);
    return (
        <AccessOrNotFoundWrapper
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
            policyID={policyId}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                style={[styles.defaultModalContainer]}
                testID={WorkspaceCategoriesPage.displayName}
                shouldShowOfflineIndicatorInWideScreen
                offlineIndicatorStyle={styles.mtAuto}
            >
                <HeaderWithBackButton
                    shouldShowBackButton={shouldUseNarrowLayout}
                    title={selectionModeHeader ? translate('common.selectMultiple') : translate('workspace.common.categories')}
                    icon={!selectionModeHeader ? Illustrations.FolderOpen : undefined}
                    shouldUseHeadlineHeader={!selectionModeHeader}
                    onBackButtonPress={() => {
                        if (isMobileSelectionModeEnabled) {
                            setSelectedCategories([]);
                            turnOffMobileSelectionMode();
                            return;
                        }

                        if (backTo) {
                            Navigation.goBack(backTo);
                            return;
                        }

                        Navigation.popToSidebar();
                    }}
                >
                    {!shouldUseNarrowLayout && getHeaderButtons()}
                </HeaderWithBackButton>
                <ConfirmModal
                    isVisible={deleteCategoriesConfirmModalVisible}
                    onConfirm={handleDeleteCategories}
                    onCancel={() => setDeleteCategoriesConfirmModalVisible(false)}
                    title={translate(selectedCategories.length === 1 ? 'workspace.categories.deleteCategory' : 'workspace.categories.deleteCategories')}
                    prompt={translate(selectedCategories.length === 1 ? 'workspace.categories.deleteCategoryPrompt' : 'workspace.categories.deleteCategoriesPrompt')}
                    confirmText={translate('common.delete')}
                    cancelText={translate('common.cancel')}
                    danger
                />
                {shouldUseNarrowLayout && <View style={[styles.pl5, styles.pr5]}>{getHeaderButtons()}</View>}
                {(!hasVisibleCategories || isLoading) && headerContent}
                {isLoading && (
                    <ActivityIndicator
                        size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE}
                        style={[styles.flex1]}
                        color={theme.spinner}
                    />
                )}
                {hasVisibleCategories && !isLoading && (
                    <SelectionListWithModal
                        canSelectMultiple={canSelectMultiple}
                        turnOnSelectionModeOnLongPress={isSmallScreenWidth}
                        onTurnOnSelectionMode={(item) => item && toggleCategory(item)}
                        sections={[{data: filteredCategoryList, isDisabled: false}]}
                        shouldUseDefaultRightHandSideCheckmark={false}
                        selectedItems={selectedCategories}
                        onCheckboxPress={toggleCategory}
                        onSelectRow={navigateToCategorySettings}
                        shouldPreventDefaultFocusOnSelectRow={!canUseTouchScreen()}
                        onSelectAll={filteredCategoryList.length > 0 ? toggleAllCategories : undefined}
                        ListItem={TableListItem}
                        listHeaderContent={headerContent}
                        shouldShowListEmptyContent={false}
                        onDismissError={dismissError}
                        customListHeader={getCustomListHeader()}
                        listHeaderWrapperStyle={[styles.ph9, styles.pv3, styles.pb5]}
                        showScrollIndicator={false}
                        addBottomSafeAreaPadding
                    />
                )}
                {!hasVisibleCategories && !isLoading && inputValue.length === 0 && (
                    <ScrollView contentContainerStyle={[styles.flexGrow1, styles.flexShrink0]}>
                        <EmptyStateComponent
                            SkeletonComponent={TableListItemSkeleton}
                            headerMediaType={CONST.EMPTY_STATE_MEDIA.ANIMATION}
                            headerMedia={LottieAnimations.GenericEmptyState}
                            title={translate('workspace.categories.emptyCategories.title')}
                            subtitleText={subtitleText}
                            headerStyles={[styles.emptyStateCardIllustrationContainer, styles.emptyFolderBG]}
                            lottieWebViewStyles={styles.emptyStateFolderWebStyles}
                            headerContentStyles={styles.emptyStateFolderWebStyles}
                            buttons={
                                !policyHasAccountingConnections
                                    ? [
                                          {
                                              icon: Expensicons.Plus,
                                              buttonText: translate('workspace.categories.addCategory'),
                                              buttonAction: navigateToCreateCategoryPage,
                                              success: true,
                                          },
                                          {
                                              icon: Expensicons.Table,
                                              buttonText: translate('common.import'),
                                              buttonAction: navigateToImportSpreadsheet,
                                          },
                                      ]
                                    : undefined
                            }
                        />
                    </ScrollView>
                )}
                <ConfirmModal
                    isVisible={isCannotDeleteOrDisableLastCategoryModalVisible}
                    onConfirm={() => setIsCannotDeleteOrDisableLastCategoryModalVisible(false)}
                    onCancel={() => setIsCannotDeleteOrDisableLastCategoryModalVisible(false)}
                    title={translate('workspace.categories.cannotDeleteOrDisableAllCategories.title')}
                    prompt={translate('workspace.categories.cannotDeleteOrDisableAllCategories.description')}
                    confirmText={translate('common.buttonConfirm')}
                    shouldShowCancelButton={false}
                />
                <ConfirmModal
                    isVisible={isOfflineModalVisible}
                    onConfirm={() => setIsOfflineModalVisible(false)}
                    title={translate('common.youAppearToBeOffline')}
                    prompt={translate('common.thisFeatureRequiresInternet')}
                    confirmText={translate('common.buttonConfirm')}
                    shouldShowCancelButton={false}
                    onCancel={() => setIsOfflineModalVisible(false)}
                    shouldHandleNavigationBack
                />
                <DecisionModal
                    title={translate('common.downloadFailedTitle')}
                    prompt={translate('common.downloadFailedDescription')}
                    isSmallScreenWidth={isSmallScreenWidth}
                    onSecondOptionSubmit={() => setIsDownloadFailureModalVisible(false)}
                    secondOptionText={translate('common.buttonConfirm')}
                    isVisible={isDownloadFailureModalVisible}
                    onClose={() => setIsDownloadFailureModalVisible(false)}
                />
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceCategoriesPage.displayName = 'WorkspaceCategoriesPage';

export default WorkspaceCategoriesPage;

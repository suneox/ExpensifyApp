import {useIsFocused} from '@react-navigation/native';
import type {ReactNode} from 'react';
import React, {useEffect, useMemo, useRef} from 'react';
import {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import type HeaderWithBackButtonProps from '@components/HeaderWithBackButton/types';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollViewWithContext from '@components/ScrollViewWithContext';
import useHandleBackButton from '@hooks/useHandleBackButton';
import useNetwork from '@hooks/useNetwork';
import useOnyx from '@hooks/useOnyx';
import usePrevious from '@hooks/usePrevious';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import {openWorkspaceView} from '@libs/actions/BankAccounts';
import BankAccount from '@libs/models/BankAccount';
import Navigation from '@libs/Navigation/Navigation';
import {goBackFromInvalidPolicy, isPendingDeletePolicy, isPolicyAdmin, shouldShowPolicy as shouldShowPolicyUtil} from '@libs/PolicyUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type {Policy} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import type IconAsset from '@src/types/utils/IconAsset';
import type {WithPolicyAndFullscreenLoadingProps} from './withPolicyAndFullscreenLoading';
import withPolicyAndFullscreenLoading from './withPolicyAndFullscreenLoading';

type WorkspacePageWithSectionsProps = WithPolicyAndFullscreenLoadingProps &
    Pick<HeaderWithBackButtonProps, 'shouldShowThreeDotsButton' | 'threeDotsMenuItems' | 'threeDotsAnchorPosition' | 'shouldShowBackButton' | 'onBackButtonPress'> & {
        shouldSkipVBBACall?: boolean;

        /** The text to display in the header */
        headerText: string;

        /** Main content of the page */
        children: ((hasVBA: boolean, policyID: string | undefined, isUsingECard: boolean) => ReactNode) | ReactNode;

        /** Content to be added as fixed footer */
        footer?: ReactNode;

        /** The route where we navigate when the user press the back button */
        backButtonRoute?: Route;

        /** Option to use the default scroll view  */
        shouldUseScrollView?: boolean;

        /** Option to show the loading page while the API is calling */
        shouldShowLoading?: boolean;

        /** Whether the offline indicator should be shown in wide screen devices */
        shouldShowOfflineIndicatorInWideScreen?: boolean;

        /** Whether to show this page to non admin policy members */
        shouldShowNonAdmin?: boolean;

        /** Whether to show the not found page */
        shouldShowNotFoundPage?: boolean;

        /** Makes firstRender ref display loading page before isLoading is change to true */
        showLoadingAsFirstRender?: boolean;

        /** Policy values needed in the component */
        policy: OnyxEntry<Policy>;

        /**
         * Icon displayed on the left of the title.
         * If it is passed, the new styling is applied to the component:
         * taller header on desktop and different font of the title.
         * */
        icon?: IconAsset;

        /** Content to be added to the header */
        headerContent?: ReactNode;

        /** TestID of the component */
        testID?: string;

        /** Whether the page is loading, example any other API call in progress */
        isLoading?: boolean;

        /** Whether to use the headline header */
        shouldUseHeadlineHeader?: boolean;

        /**
         * If enabled, the content will have a bottom padding equal to account for the safe bottom area inset.
         */
        addBottomSafeAreaPadding?: boolean;
    };

function fetchData(policyID: string | undefined, skipVBBACal?: boolean) {
    if (skipVBBACal) {
        return;
    }

    openWorkspaceView(policyID);
}

function WorkspacePageWithSections({
    backButtonRoute,
    children = () => null,
    footer = null,
    icon = undefined,
    headerText,
    policy,
    policyDraft,
    route,
    shouldUseScrollView = false,
    showLoadingAsFirstRender = true,
    shouldSkipVBBACall = true,
    shouldShowBackButton = false,
    shouldShowLoading = true,
    shouldShowOfflineIndicatorInWideScreen = false,
    shouldShowNonAdmin = false,
    headerContent,
    testID,
    shouldShowNotFoundPage = false,
    isLoading: isPageLoading = false,
    onBackButtonPress,
    shouldShowThreeDotsButton,
    threeDotsMenuItems,
    threeDotsAnchorPosition,
    shouldUseHeadlineHeader = true,
    addBottomSafeAreaPadding = false,
}: WorkspacePageWithSectionsProps) {
    const styles = useThemeStyles();
    const policyID = route.params?.policyID;
    const {isOffline} = useNetwork({onReconnect: () => fetchData(policyID, shouldSkipVBBACall)});

    const [account] = useOnyx(ONYXKEYS.ACCOUNT, {canBeMissing: false});
    const [reimbursementAccount = CONST.REIMBURSEMENT_ACCOUNT.DEFAULT_DATA] = useOnyx(ONYXKEYS.REIMBURSEMENT_ACCOUNT, {canBeMissing: true});
    const [currentUserLogin] = useOnyx(ONYXKEYS.SESSION, {
        selector: (session) => session?.email,
        canBeMissing: true,
    });

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const isLoading = (reimbursementAccount?.isLoading || isPageLoading) ?? true;
    const achState = policy?.achAccount?.state ?? reimbursementAccount?.achData?.state;
    const isUsingECard = account?.isUsingExpensifyCard ?? false;
    const hasVBA = achState === BankAccount.STATE.OPEN;
    const content = typeof children === 'function' ? children(hasVBA, policyID, isUsingECard) : children;
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const firstRender = useRef(showLoadingAsFirstRender);
    const isFocused = useIsFocused();
    const prevPolicy = usePrevious(policy);

    useEffect(() => {
        // Because isLoading is false before merging in Onyx, we need firstRender ref to display loading page as well before isLoading is change to true
        firstRender.current = false;
    }, []);

    useEffect(() => {
        fetchData(policyID, shouldSkipVBBACall);
        // eslint-disable-next-line react-compiler/react-compiler
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const shouldShowPolicy = useMemo(() => shouldShowPolicyUtil(policy, false, currentUserLogin), [policy, currentUserLogin]);
    const isPendingDelete = isPendingDeletePolicy(policy);
    const prevIsPendingDelete = isPendingDeletePolicy(prevPolicy);
    const shouldShow = useMemo(() => {
        // If the policy object doesn't exist or contains only error data, we shouldn't display it.
        if (((isEmptyObject(policy) || (Object.keys(policy).length === 1 && !isEmptyObject(policy.errors))) && isEmptyObject(policyDraft)) || shouldShowNotFoundPage) {
            return true;
        }

        // We check isPendingDelete and prevIsPendingDelete to prevent the NotFound view from showing right after we delete the workspace
        return (!isEmptyObject(policy) && !isPolicyAdmin(policy) && !shouldShowNonAdmin) || (!shouldShowPolicy && (!isPendingDelete || prevIsPendingDelete));
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [policy, shouldShowNonAdmin, shouldShowPolicy]);

    const handleOnBackButtonPress = () => {
        if (onBackButtonPress) {
            onBackButtonPress();
            return true;
        }

        if (backButtonRoute) {
            Navigation.goBack(backButtonRoute);
            return true;
        }

        Navigation.popToSidebar();
        return true;
    };

    useHandleBackButton(handleOnBackButtonPress);

    return (
        <ScreenWrapper
            enableEdgeToEdgeBottomSafeAreaPadding
            shouldEnablePickerAvoiding={false}
            shouldEnableMaxHeight
            testID={testID ?? WorkspacePageWithSections.displayName}
            shouldShowOfflineIndicator={!shouldShow}
            shouldShowOfflineIndicatorInWideScreen={shouldShowOfflineIndicatorInWideScreen && !shouldShow}
        >
            <FullPageNotFoundView
                onBackButtonPress={() => Navigation.goBack(ROUTES.WORKSPACES_LIST.route)}
                onLinkPress={goBackFromInvalidPolicy}
                shouldShow={shouldShow}
                subtitleKey={shouldShowPolicy ? 'workspace.common.notAuthorized' : undefined}
                shouldForceFullScreen
                shouldDisplaySearchRouter
            >
                <HeaderWithBackButton
                    title={headerText}
                    onBackButtonPress={handleOnBackButtonPress}
                    shouldShowBackButton={shouldUseNarrowLayout || shouldShowBackButton}
                    icon={icon ?? undefined}
                    shouldShowThreeDotsButton={shouldShowThreeDotsButton}
                    threeDotsMenuItems={threeDotsMenuItems}
                    threeDotsAnchorPosition={threeDotsAnchorPosition}
                    shouldUseHeadlineHeader={shouldUseHeadlineHeader}
                >
                    {headerContent}
                </HeaderWithBackButton>
                {!isOffline && (isLoading || firstRender.current) && shouldShowLoading && isFocused ? (
                    <FullScreenLoadingIndicator style={[styles.flex1, styles.pRelative]} />
                ) : (
                    <>
                        {shouldUseScrollView ? (
                            <ScrollViewWithContext
                                keyboardShouldPersistTaps="handled"
                                addBottomSafeAreaPadding={addBottomSafeAreaPadding}
                                style={[styles.settingsPageBackground, styles.flex1, styles.w100]}
                            >
                                <View style={[styles.w100, styles.flex1]}>{content}</View>
                            </ScrollViewWithContext>
                        ) : (
                            content
                        )}
                        {footer}
                    </>
                )}
            </FullPageNotFoundView>
        </ScreenWrapper>
    );
}

WorkspacePageWithSections.displayName = 'WorkspacePageWithSections';

export default withPolicyAndFullscreenLoading(WorkspacePageWithSections);

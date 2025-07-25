import React, {useEffect, useRef} from 'react';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import {useSession} from '@components/OnyxListItemProvider';
import ScreenWrapper from '@components/ScreenWrapper';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import {openApp} from '@libs/actions/App';
import Navigation from '@libs/Navigation/Navigation';
import {waitForIdle} from '@libs/Network/SequentialQueue';
import CONST from '@src/CONST';
import SCREENS from '@src/SCREENS';
import SignInPage from './SignInPage';
import type {SignInPageRef} from './SignInPage';

function SignInModal() {
    const theme = useTheme();
    const StyleUtils = useStyleUtils();
    const signinPageRef = useRef<SignInPageRef | null>(null);
    const session = useSession();

    useEffect(() => {
        const isAnonymousUser = session?.authTokenType === CONST.AUTH_TOKEN_TYPES.ANONYMOUS;
        if (!isAnonymousUser) {
            // Signing in RHP is only for anonymous users
            Navigation.isNavigationReady().then(() => {
                Navigation.dismissModal();
            });

            // To prevent deadlock when OpenReport and OpenApp overlap, wait for the queue to be idle before calling openApp.
            // This ensures that any communication gaps between the client and server during OpenReport processing do not cause the queue to pause,
            // which would prevent us from processing or clearing the queue.
            waitForIdle().then(() => {
                openApp(true);
            });
        }
    }, [session?.authTokenType]);

    return (
        <ScreenWrapper
            style={[StyleUtils.getBackgroundColorStyle(theme.PAGE_THEMES[SCREENS.RIGHT_MODAL.SIGN_IN].backgroundColor)]}
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
            shouldShowOfflineIndicator={false}
            testID={SignInModal.displayName}
        >
            <HeaderWithBackButton
                onBackButtonPress={() => {
                    if (!signinPageRef.current) {
                        Navigation.goBack();
                        return;
                    }
                    signinPageRef.current?.navigateBack();
                }}
            />
            <SignInPage
                shouldEnableMaxHeight={false}
                ref={signinPageRef}
            />
        </ScreenWrapper>
    );
}

SignInModal.displayName = 'SignInModal';

export default SignInModal;

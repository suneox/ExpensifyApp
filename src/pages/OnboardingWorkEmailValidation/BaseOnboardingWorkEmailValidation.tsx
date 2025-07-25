import {useIsFocused} from '@react-navigation/native';
import React, {useCallback, useEffect} from 'react';
import {View} from 'react-native';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import OnboardingMergingAccountBlockedView from '@components/OnboardingMergingAccountBlockedView';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import ValidateCodeForm from '@components/ValidateCodeActionModal/ValidateCodeForm';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import AccountUtils from '@libs/AccountUtils';
import {openOldDotLink} from '@libs/actions/Link';
import {setOnboardingErrorMessage, setOnboardingMergeAccountStepValue, updateOnboardingValuesAndNavigation} from '@libs/actions/Welcome';
import Navigation from '@libs/Navigation/Navigation';
import {MergeIntoAccountAndLogin} from '@userActions/Session';
import {resendValidateCode} from '@userActions/User';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {BaseOnboardingWorkEmailValidationProps} from './types';

function BaseOnboardingWorkEmailValidation({shouldUseNativeStyles}: BaseOnboardingWorkEmailValidationProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [account] = useOnyx(ONYXKEYS.ACCOUNT, {canBeMissing: true});
    const [session] = useOnyx(ONYXKEYS.SESSION, {canBeMissing: true});
    const [credentials] = useOnyx(ONYXKEYS.CREDENTIALS, {canBeMissing: true});
    const [onboardingEmail] = useOnyx(ONYXKEYS.FORMS.ONBOARDING_WORK_EMAIL_FORM, {canBeMissing: true});
    const workEmail = onboardingEmail?.onboardingWorkEmail;

    const {onboardingIsMediumOrLargerScreenWidth} = useResponsiveLayout();
    const [onboardingValues] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {canBeMissing: true});
    const isVsb = onboardingValues && 'signupQualifier' in onboardingValues && onboardingValues.signupQualifier === CONST.ONBOARDING_SIGNUP_QUALIFIERS.VSB;
    const isSmb = onboardingValues?.signupQualifier === CONST.ONBOARDING_SIGNUP_QUALIFIERS.SMB;
    const [onboardingErrorMessage] = useOnyx(ONYXKEYS.ONBOARDING_ERROR_MESSAGE, {canBeMissing: true});
    const isValidateCodeFormSubmitting = AccountUtils.isValidateCodeFormSubmitting(account);
    const isFocused = useIsFocused();

    useEffect(() => {
        if (onboardingValues?.isMergeAccountStepCompleted === undefined) {
            return;
        }
        setOnboardingErrorMessage('');
        if (onboardingValues?.shouldRedirectToClassicAfterMerge) {
            openOldDotLink(CONST.OLDDOT_URLS.INBOX, true);
            return;
        }
        // Once we verify that shouldValidate is false, we need to force replace the screen
        // so that we don't navigate back on back button press
        if (isVsb) {
            Navigation.navigate(ROUTES.ONBOARDING_ACCOUNTING.getRoute(), {forceReplace: true});
            return;
        }

        if (isSmb) {
            Navigation.navigate(ROUTES.ONBOARDING_EMPLOYEES.getRoute(), {forceReplace: true});
            return;
        }

        if (!onboardingValues?.isMergeAccountStepSkipped) {
            Navigation.navigate(ROUTES.ONBOARDING_WORKSPACES.getRoute(), {forceReplace: true});
            return;
        }

        Navigation.navigate(ROUTES.ONBOARDING_PURPOSE.getRoute(), {forceReplace: true});
    }, [onboardingValues, isVsb, isSmb, isFocused]);

    const sendValidateCode = useCallback(() => {
        if (!credentials?.login) {
            return;
        }
        resendValidateCode(credentials.login);
    }, [credentials?.login]);

    const validateAccountAndMerge = useCallback(
        (validateCode: string) => {
            setOnboardingErrorMessage('');
            MergeIntoAccountAndLogin(workEmail, validateCode, session?.accountID);
        },
        [workEmail, session?.accountID],
    );

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom
            testID="BaseOnboardingWorkEmailValidation"
            style={[styles.defaultModalContainer, shouldUseNativeStyles && styles.pt8]}
        >
            <HeaderWithBackButton
                shouldShowBackButton={!onboardingValues?.isMergingAccountBlocked}
                progressBarPercentage={15}
                onBackButtonPress={() => {
                    updateOnboardingValuesAndNavigation(onboardingValues);
                }}
            />
            {onboardingValues?.isMergingAccountBlocked ? (
                <View style={[styles.flex1, onboardingIsMediumOrLargerScreenWidth && styles.mt5, onboardingIsMediumOrLargerScreenWidth ? styles.mh8 : styles.mh5]}>
                    <OnboardingMergingAccountBlockedView
                        workEmail={workEmail}
                        isVsb={isVsb}
                    />
                </View>
            ) : (
                <View style={[styles.flex1, onboardingIsMediumOrLargerScreenWidth && styles.mt5, onboardingIsMediumOrLargerScreenWidth ? styles.mh8 : styles.mh5]}>
                    <Text style={styles.textHeadlineH1}>{translate('onboarding.workEmailValidation.title')}</Text>
                    <Text style={[styles.textNormal, styles.colorMuted, styles.textAlignLeft, styles.mt5]}>{translate('onboarding.workEmailValidation.magicCodeSent', {workEmail})}</Text>
                    <ValidateCodeForm
                        handleSubmitForm={validateAccountAndMerge}
                        sendValidateCode={sendValidateCode}
                        validateCodeActionErrorField="mergeIntoAccountAndLogIn"
                        clearError={() => setOnboardingErrorMessage('')}
                        buttonStyles={[styles.flex2, styles.justifyContentEnd, styles.mb5]}
                        shouldShowSkipButton
                        handleSkipButtonPress={() => {
                            setOnboardingErrorMessage('');
                            setOnboardingMergeAccountStepValue(true, true);
                        }}
                        isLoading={isValidateCodeFormSubmitting}
                        validateError={onboardingErrorMessage ? {invalidCodeError: onboardingErrorMessage} : undefined}
                    />
                </View>
            )}
        </ScreenWrapper>
    );
}

BaseOnboardingWorkEmailValidation.displayName = 'BaseOnboardingWorkEmailValidation';

export default BaseOnboardingWorkEmailValidation;

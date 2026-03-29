import {signOutAndRedirectToSignIn} from '@libs/actions/Session';
import type {Middleware} from '@libs/Request';

/**
 * Handles the case when the user's copilot has been deleted.
 * If the response contains jsonCode 408 and a message indicating copilot deletion,
 * the function signs the user out and redirects them to the sign-in page.
 */

const handleDeletedAccount: Middleware = (requestResponse) =>
    requestResponse.then((response) => {
        if (response?.jsonCode !== 408 || !response?.message?.includes('The account you are trying to use is deleted.')) {
            return response;
        }
        // #84186-001: Entry point for bug flow
        console.log('[#84186-001] HandleDeletedAccount: 408 "account deleted" detected');
        console.log('[#84186-001] Triggering signOutAndRedirectToSignIn(true, false, true, true)');
        signOutAndRedirectToSignIn(true, false, true, true);
    });

export default handleDeletedAccount;

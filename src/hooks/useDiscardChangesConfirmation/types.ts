type UseDiscardChangesConfirmationOptions = {
    getHasUnsavedChanges: () => boolean;
    onCancel?: () => void;
    onVisibilityChange?: (visible: boolean) => void;
    isEnabled?: boolean;
    shouldScopeRecoveryToFocus?: boolean;
};

export default UseDiscardChangesConfirmationOptions;

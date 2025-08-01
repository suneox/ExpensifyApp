module.exports = {
    plugins: ['@typescript-eslint', 'deprecation'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.json',
    },
    rules: {
        'deprecation/deprecation': 'error',
        'rulesdir/no-default-id-values': 'error',
        'rulesdir/provide-canBeMissing-in-useOnyx': 'error',
        'rulesdir/no-unstable-hook-defaults': 'error',
        'no-restricted-syntax': [
            'error',
            {
                selector: 'ImportNamespaceSpecifier[parent.source.value=/^@libs/]',
                message: 'Namespace imports from @libs are not allowed. Use named imports instead. Example: import { method } from "@libs/module"',
            },
            {
                selector: 'ImportNamespaceSpecifier[parent.source.value=/^@userActions/]',
                message: 'Namespace imports from @userActions are not allowed. Use named imports instead. Example: import { action } from "@userActions/module"',
            },
        ],
    },
    overrides: [
        {
            files: ['**/libs/**/*.{ts,tsx}'],
            rules: {
                'no-restricted-syntax': [
                    'error',
                    {
                        selector: 'ImportNamespaceSpecifier[parent.source.value=/^\\.\\./]',
                        message: 'Namespace imports are not allowed. Use named imports instead. Example: import { method } from "../libs/module"',
                    },
                    {
                        selector: 'ImportNamespaceSpecifier[parent.source.value=/^\\./]',
                        message: 'Namespace imports are not allowed. Use named imports instead. Example: import { method } from "./libs/module"',
                    },
                ],
            },
        },
    ],
};

import React, {useCallback} from 'react';
import type {SearchColumnType, SortOrder} from '@components/Search/types';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type * as OnyxTypes from '@src/types/onyx';
import SortableTableHeader from './SortableTableHeader';
import type {SortableColumnName} from './types';

type SearchColumnConfig = {
    columnName: SearchColumnType;
    translationKey: TranslationPaths;
    isColumnSortable?: boolean;
};

const expenseHeaders: SearchColumnConfig[] = [
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.RECEIPT,
        translationKey: 'common.receipt',
        isColumnSortable: false,
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.TYPE,
        translationKey: 'common.type',
        isColumnSortable: false,
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.DATE,
        translationKey: 'common.date',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.MERCHANT,
        translationKey: 'common.merchant',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.DESCRIPTION,
        translationKey: 'common.description',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.FROM,
        translationKey: 'common.from',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.TO,
        translationKey: 'common.to',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.CATEGORY,
        translationKey: 'common.category',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.TAG,
        translationKey: 'common.tag',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.TAX_AMOUNT,
        translationKey: 'common.tax',
        isColumnSortable: false,
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.TOTAL_AMOUNT,
        translationKey: 'common.total',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.ACTION,
        translationKey: 'common.action',
        isColumnSortable: false,
    },
];

const taskHeaders: SearchColumnConfig[] = [
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.DATE,
        translationKey: 'common.date',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.TITLE,
        translationKey: 'common.title',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.DESCRIPTION,
        translationKey: 'common.description',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.FROM,
        translationKey: 'common.from',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.IN,
        translationKey: 'common.sharedIn',
        isColumnSortable: false,
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.ASSIGNEE,
        translationKey: 'common.assignee',
    },
    {
        columnName: CONST.SEARCH.TABLE_COLUMNS.ACTION,
        translationKey: 'common.action',
        isColumnSortable: false,
    },
];

const SearchColumns = {
    [CONST.SEARCH.DATA_TYPES.EXPENSE]: expenseHeaders,
    [CONST.SEARCH.DATA_TYPES.INVOICE]: expenseHeaders,
    [CONST.SEARCH.DATA_TYPES.TRIP]: expenseHeaders,
    [CONST.SEARCH.DATA_TYPES.TASK]: taskHeaders,
    [CONST.SEARCH.DATA_TYPES.CHAT]: null,
};

type SearchTableHeaderProps = {
    metadata: OnyxTypes.SearchResults['search'];
    sortBy?: SearchColumnType;
    sortOrder?: SortOrder;
    onSortPress: (column: SearchColumnType, order: SortOrder) => void;
    shouldShowYear: boolean;
    isAmountColumnWide: boolean;
    isTaxAmountColumnWide: boolean;
    shouldShowSorting: boolean;
    canSelectMultiple: boolean;
    columns: SortableColumnName[];
};

function SearchTableHeader({
    metadata,
    sortBy,
    sortOrder,
    onSortPress,
    shouldShowYear,
    shouldShowSorting,
    canSelectMultiple,
    isAmountColumnWide,
    isTaxAmountColumnWide,
    columns,
}: SearchTableHeaderProps) {
    const styles = useThemeStyles();
    // eslint-disable-next-line rulesdir/prefer-shouldUseNarrowLayout-instead-of-isSmallScreenWidth
    const {isSmallScreenWidth, isMediumScreenWidth} = useResponsiveLayout();
    const displayNarrowVersion = isMediumScreenWidth || isSmallScreenWidth;

    const shouldShowColumn = useCallback(
        (columnName: SortableColumnName) => {
            return columns.includes(columnName);
        },
        [columns],
    );

    if (displayNarrowVersion) {
        return;
    }

    const columnConfig = SearchColumns[metadata.type];

    if (!columnConfig) {
        return;
    }

    return (
        <SortableTableHeader
            columns={columnConfig}
            shouldShowColumn={shouldShowColumn}
            dateColumnSize={shouldShowYear ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL}
            amountColumnSize={isAmountColumnWide ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL}
            taxAmountColumnSize={isTaxAmountColumnWide ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL}
            shouldShowSorting={shouldShowSorting}
            sortBy={sortBy}
            sortOrder={sortOrder}
            // Don't butt up against the 'select all' checkbox if present
            containerStyles={canSelectMultiple && [styles.pl4]}
            onSortPress={(columnName, order) => {
                if (columnName === CONST.REPORT.TRANSACTION_LIST.COLUMNS.COMMENTS) {
                    return;
                }
                onSortPress(columnName, order);
            }}
        />
    );
}

SearchTableHeader.displayName = 'SearchTableHeader';

export default SearchTableHeader;

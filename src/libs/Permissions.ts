/* eslint-disable @typescript-eslint/naming-convention */
import type { OnyxEntry } from 'react-native-onyx';
import CONST from '@src/CONST';
import type Beta from '@src/types/onyx/Beta';
import Onyx from 'react-native-onyx';
import ONYXKEYS from '@src/ONYXKEYS';

function canUseAllBetas(betas: OnyxEntry<Beta[]>): boolean {
    return !!betas?.includes(CONST.BETAS.ALL);
}

function canUseChronos(betas: OnyxEntry<Beta[]>): boolean {
    return !!betas?.includes(CONST.BETAS.CHRONOS_IN_CASH) || canUseAllBetas(betas);
}

function canUseDefaultRooms(betas: OnyxEntry<Beta[]>): boolean {
    return !!betas?.includes(CONST.BETAS.DEFAULT_ROOMS) || canUseAllBetas(betas);
}

function canUseCommentLinking(betas: OnyxEntry<Beta[]>): boolean {
    return !!betas?.includes(CONST.BETAS.BETA_COMMENT_LINKING) || canUseAllBetas(betas);
}

function canUseReportFields(betas: OnyxEntry<Beta[]>): boolean {
    return !!betas?.includes(CONST.BETAS.REPORT_FIELDS) || canUseAllBetas(betas);
}

function canUseViolations(betas: OnyxEntry<Beta[]>): boolean {
    return !!betas?.includes(CONST.BETAS.VIOLATIONS) || canUseAllBetas(betas);
}

/**
 * Link previews are temporarily disabled.
 */
function canUseLinkPreviews(): boolean {
    return false;
}

export default {
    canUseChronos,
    canUseDefaultRooms,
    canUseCommentLinking,
    canUseLinkPreviews,
    canUseViolations,
    canUseReportFields,
};
console.log(`___________ SET::::8B0C6AC0C96B2EB5 ___________`);

const sampleTags = {
    K0: {enabled:true, name: `0a`},
    K1: {enabled:true, name: `中国`},
    K2: {enabled:true, name: `1`},
    K3: {enabled:true, name: `10bc`},
    K4: {enabled:true, name: `2`},
    K5: {enabled:true, name: `3`},
    K6: {enabled:true, name: `10`},
    K7: {enabled:true, name: `20a`},
    K8: {enabled:true, name: `a`},
    K9: {enabled:true, name: `a1`},
    K10: {enabled:true, name: `0`},
    K11: {enabled:true, name: `a20`},
    K12: {enabled:true, name: `20`},
    K13: {enabled:true, name: `b`},
    K14: {enabled:true, name: `b10`},
    K141: {enabled:true, name: `b00`},
    K15: {enabled:true, name: `c`},
    K16: {enabled:true, name: `b1`},
    K17: {enabled:true, name: `日本`},
    K18: {enabled:true, name: `!`},
    K19: {enabled:true, name: `@`},
    K20: {enabled:true, name: `~`},
    K21: {enabled:true, name: `#`},
    K22: {enabled:true, name: `$`},
    K23: {enabled:true, name: `@`},
    K24: {enabled:true, name: `%`},
    K25: {enabled:true, name: `#`},
    K26: {enabled:true, name: `!`},
    K27: {enabled:true, name: `$`},
    K28: {enabled:true, name: `&`},
    K29: {enabled:true, name: `^`},
    K30: {enabled:true, name: `*`},
    K31: {enabled:true, name: `(`},
    K32: {enabled:true, name: `)`},
    K33: {enabled:true, name: `+`},
    K34: {enabled:true, name: '`'},
    K35: {enabled:true, name: `_`},
    K36: {enabled:true, name: `-`},
    K37: {enabled:true, name: `=`},
    K38: {enabled:true, name: `{`},
    K39: {enabled:true, name: `/`},
    K40: {enabled:true, name: `;`},
    K41: {enabled:true, name: `}`},
    K42: {enabled:true, name: `|`},
    K43: {enabled:true, name: `[`},
    K44: {enabled:true, name: `:`},
    K45: {enabled:true, name: `<`},
    K46: {enabled:true, name: `]`},
    K47: {enabled:true, name: `>`},
    K48: {enabled:true, name: `?`},
    K49: {enabled:true, name: `.`},
    K50: {enabled:true, name: `'`},
};

Onyx.set('policyTags_8B0C6AC0C96B2EB5', {
    'Custom Name': {
        name: 'Custom Name',
        tags: sampleTags,
    },
});
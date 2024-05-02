import React from 'react';
import DraggableFlatList from 'react-native-draggable-flatlist';
import type {FlatList} from 'react-native-gesture-handler';
import useThemeStyles from '@hooks/useThemeStyles';
import type {DraggableListProps} from './types';
import { View } from 'react-native';

function DraggableList<T>({renderClone, shouldUsePortal, ListFooterComponent, ...viewProps}: DraggableListProps<T>, ref: React.ForwardedRef<FlatList<T>>) {
    const styles = useThemeStyles();
    if (Number('1') === 1 && ListFooterComponent) {
        // return ListFooterComponent
    }
    return (
        <View style={styles.flex1}>
            <DraggableFlatList
                ref={ref}
                // contentContainerStyle={styles.flexGrow1}
                // ListFooterComponentStyle={styles.flex1}
                // ListFooterComponent={ListFooterComponent}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...viewProps}
            />
            <View style={styles.flexGrow1}>
                {ListFooterComponent}
            </View>
        </View>
    );
}

DraggableList.displayName = 'DraggableList';

export default React.forwardRef(DraggableList);

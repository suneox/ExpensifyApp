import {useCallback, useEffect, useRef} from 'react';
import {TextInput} from 'react-native';

type UseInputHistoryProps = {
    value: string;
    textInput: React.MutableRefObject<TextInput | HTMLInputElement | HTMLTextAreaElement | null>;
    onChangeText: (text: string) => void;
};

type UseInputHistoryReturn = {
    handleUndo: () => void;
    handleRedo: () => void;
    resetHistory: () => void;
};

const useInputHistory = (props: UseInputHistoryProps): UseInputHistoryReturn => {
    const {value, textInput, onChangeText: setValue} = props;
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef<number>(0);

    const handleUndo = useCallback(() => {
        if (historyIndexRef.current <= 0) {
            return;
        }
        historyIndexRef.current -= 1;
        setValue(historyRef.current[historyIndexRef.current]);
    }, [setValue]);

    const handleRedo = useCallback(() => {
        
        if (historyIndexRef.current >= historyRef.current.length - 1) {
            return
        }
        historyIndexRef.current += 1;
        setValue(historyRef.current[historyIndexRef.current]);
    }, [setValue]);

    useEffect(() => {
        if (value === historyRef.current[historyIndexRef.current]) {
            return;
        }
        historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), value];
        historyIndexRef.current += 1;
    }, [value]);

    const keyDownHandler = useCallback((e: KeyboardEvent) => {
        const { shiftKey, metaKey, ctrlKey, key } = e;
        // check event on macos
        if (metaKey && key === 'z') {
            e.preventDefault();
            if (shiftKey) {
                handleRedo();
            } else {
                handleUndo();
            }
        }
        // check event on windows
        else if (ctrlKey) {
            if (key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        }
    },[handleRedo, handleUndo]);

    useEffect(() => {
        if (!textInput?.current) {
            return;
        }

        const inputRef = textInput.current as HTMLInputElement;

        inputRef.addEventListener('keydown', keyDownHandler);
        return () => {
            if (!inputRef) {
                return;
            }
            inputRef.removeEventListener('keydown', keyDownHandler);
        };
    }, [keyDownHandler, textInput]);

    const resetHistory = useCallback(() => {
        historyRef.current = [];
        historyIndexRef.current = 0;
    }, []);

    return {
        handleUndo,
        handleRedo,
        resetHistory,
    };
};

export default useInputHistory;

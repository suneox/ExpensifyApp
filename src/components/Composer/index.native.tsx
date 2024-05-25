import type {ForwardedRef} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {TextInput} from 'react-native';
import { StyleSheet } from 'react-native';
import type {AnimatedMarkdownTextInputRef} from '@components/RNMarkdownTextInput';
import RNMarkdownTextInput from '@components/RNMarkdownTextInput';
import useMarkdownStyle from '@hooks/useMarkdownStyle';
import useResetComposerFocus from '@hooks/useResetComposerFocus';
import useStyleUtils from '@hooks/useStyleUtils';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import updateIsFullComposerAvailable from '@libs/ComposerUtils/updateIsFullComposerAvailable';
import type {ComposerProps} from './types';
import RNFS from 'react-native-fs';
import Clipboard from '@react-native-clipboard/clipboard';

let imageRef: string = '';
function Composer(
    {
        shouldClear = false,
        onClear = () => {},
        isDisabled = false,
        maxLines,
        isComposerFullSize = false,
        setIsFullComposerAvailable = () => {},
        autoFocus = false,
        style,
        // On native layers we like to have the Text Input not focused so the
        // user can read new chats without the keyboard in the way of the view.
        // On Android the selection prop is required on the TextInput but this prop has issues on IOS
        selection,
        value,
        ...props
    }: ComposerProps,
    ref: ForwardedRef<TextInput>,
) {
    const textInput = useRef<AnimatedMarkdownTextInputRef | null>(null);
    const {isFocused, shouldResetFocus} = useResetComposerFocus(textInput);
    const theme = useTheme();
    const markdownStyle = useMarkdownStyle(value);
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();

    /**
     * Set the TextInput Ref
     * @param {Element} el
     */
    const setTextInputRef = useCallback((el: AnimatedMarkdownTextInputRef) => {
        textInput.current = el;
        if (typeof ref !== 'function' || textInput.current === null) {
            return;
        }

        // This callback prop is used by the parent component using the constructor to
        // get a ref to the inner textInput element e.g. if we do
        // <constructor ref={el => this.textInput = el} /> this will not
        // return a ref to the component, but rather the HTML element by default
        ref(textInput.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!shouldClear) {
            return;
        }
        textInput.current?.clear();
        onClear();
    }, [shouldClear, onClear]);

    const maxHeightStyle = useMemo(() => StyleUtils.getComposerMaxHeightStyle(maxLines, isComposerFullSize), [StyleUtils, isComposerFullSize, maxLines]);
    const composerStyle = useMemo(() => StyleSheet.flatten(style), [style]);

    const convertBase64ToFile = async (base64Data: string, fileName: string, fileType: string) => {
        try {
            const filePath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
            const base64 = base64Data.split(';base64,').pop() as string;
            await RNFS.writeFile(filePath, base64, 'base64');

            return {
                uri: `file://${filePath}`,
                type: `image/${fileType}`,
                name: fileName,
            };
        } catch (error) {
            console.error('Error converting base64 to file:', error);
            return null;
        }
    };

    const parseImageFileType = (base64Data: string) => {
        try {
            const matches = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,/);
            if (matches && matches.length > 1) {
                return matches[1].toLowerCase();
            }
        } catch (error) {
            console.error('Error parsing image file type:', error);
        }
        return null;
    };

    const handleTextChange = useCallback(async (_text: string) => {
        let text = _text;
        console.log('handleTextChange', text);
        // const base64ImageRegex = /data:image\/(?:jpeg|png|gif|svg\+xml|bmp|webp|x-icon);base64,([A-Za-z0-9+/=]+)/g;
        const base64ImageRegex = /data:image\/(png|jpg|jpeg|gif);base64,([a-zA-Z0-9+/=\s]+)/s;

        const match = text.match(base64ImageRegex);
        if(!match) {
            if(!text.includes('EXP_IMAGE')) {
                console.log('No base64 string found');
                props.onChangeText?.(text);
                return;
            }
            console.log('Found base64 string:', imageRef.slice(0, 100));
            text = text.replace('EXP_IMAGE', imageRef);
            console.log(text);
        }
        // Step 1: Remove base64-encoded image data from the text
        const textWithoutImages = text.replace(base64ImageRegex, '');

        // Step 2: Extract removed base64 data
        const extractedBase64Data = text.match(base64ImageRegex);

        // Step 3: Assign the extracted base64 data to a variable
        const image = extractedBase64Data?.[0] as string; // Assuming there is only one image in the text

        console.log({textWithoutImages}); // Output the text without images
        console.log({image}); // Output the extracted base64 data of the image

        const fileType = parseImageFileType(image) as string;
        const fileName = `${Date.now()}.${fileType}`;

        console.log({fileType, fileName});
        const file = await convertBase64ToFile(image, fileName, fileType);
        
        console.log({file});

        props.onPasteFile?.(file);

    }, []);

    const [isPressing, setIsPressing] = useState(false);

    let longPressTimer: NodeJS.Timeout | null = null;
    const handleLongPress = async (e) => {
        e.persist();
        longPressTimer = setTimeout(async () => {
            setIsPressing(true);
            console.log('Long press detected!');
            const hasImage = await Clipboard.hasImage();
            console.log({hasImage});
            if(hasImage) {
                Clipboard.getImageJPG().then((image) => {
                    console.log({ image: image.slice(0, 100)});
                    imageRef = image;
                });
                Clipboard.setString(`EXP_IMAGE`);
            }
            const hasString = await Clipboard.hasString();
            if(hasString) {
                const text = await Clipboard.getString();
                console.log({text});
            }
        }, 500);
    };

    const handlePressOut = (e) => {
        e.persist();
        if (isPressing) {
            setIsPressing(false);
            clearTimeout(longPressTimer as NodeJS.Timeout);
        }
    };

    return (
        <RNMarkdownTextInput
            multiline
            autoComplete="off"
            placeholderTextColor={theme.placeholderText}
            ref={setTextInputRef}
            value={value}
            onContentSizeChange={(e) => updateIsFullComposerAvailable({maxLines, isComposerFullSize, isDisabled, setIsFullComposerAvailable}, e, styles, true)}
            rejectResponderTermination={false}
            smartInsertDelete={false}
            textAlignVertical="center"
            style={[composerStyle, maxHeightStyle]}
            markdownStyle={markdownStyle}
            autoFocus={autoFocus}
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...props}
            readOnly={isDisabled}
            onBlur={(e) => {
                if (!isFocused) {
                    shouldResetFocus.current = true; // detect the input is blurred when the page is hidden
                }
                props?.onBlur?.(e);
            }}
            onPressIn={handleLongPress}
            onPressOut={handlePressOut}
            onChangeText={handleTextChange}
        />
    );
}

Composer.displayName = 'Composer';

export default React.forwardRef(Composer);

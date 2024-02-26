import type { ComponentType, ForwardedRef, RefAttributes } from 'react';
import React, { forwardRef, useEffect, useRef } from 'react';
import getComponentDisplayName from '@libs/getComponentDisplayName';
import addViewportResizeListener from '@libs/VisualViewport';
import CONST from '@src/CONST';
import useDebouncedState from '@hooks/useDebouncedState';

type ViewportOffsetTopProps = {
    // viewportOffsetTop returns the offset of the top edge of the visual viewport from the
    // top edge of the layout viewport in CSS pixels, when the visual viewport is resized.
    viewportOffsetTop: number;
};

export default function withViewportOffsetTop<TProps extends ViewportOffsetTopProps, TRef>(WrappedComponent: ComponentType<TProps & RefAttributes<TRef>>) {
    function WithViewportOffsetTop(props: Omit<TProps, keyof ViewportOffsetTopProps>, ref: ForwardedRef<TRef>) {
        const [, viewportOffsetTop, setViewportOffsetTop] = useDebouncedState(0, CONST.TIMING.VIEWPORT_DEBOUNCE_TIME);
        const initialHeight = useRef(window.visualViewport?.height ?? window.innerHeight).current;
        const cachedDefaultOffsetTop = useRef<number>(0)
        useEffect(() => {
            const updateDimensions = (event: Event) => {
                const targetOffsetTop = (event.target instanceof VisualViewport && event.target.offsetTop) || 0;
                if (window.visualViewport) {
                    const adjustScrollY = Math.round(initialHeight - window.visualViewport.height);
                    if (cachedDefaultOffsetTop.current === 0) {
                        cachedDefaultOffsetTop.current = targetOffsetTop;
                    }
                    
                    if (adjustScrollY > targetOffsetTop) {
                        setViewportOffsetTop(adjustScrollY);
                    } else if (targetOffsetTop !== 0 && adjustScrollY === targetOffsetTop) {
                        setViewportOffsetTop(cachedDefaultOffsetTop.current);
                    } else {
                        setViewportOffsetTop(targetOffsetTop);
                    }
                }
            };

            const removeViewportResizeListener = addViewportResizeListener(updateDimensions);

            return () => {
                removeViewportResizeListener();
            };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        useEffect(() => {
            window.scrollTo({ top: viewportOffsetTop });
        }, [viewportOffsetTop])

        return (
            <WrappedComponent
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...(props as TProps)}
                ref={ref}
                viewportOffsetTop={viewportOffsetTop}
            />
        );
    }

    WithViewportOffsetTop.displayName = `WithViewportOffsetTop(${getComponentDisplayName(WrappedComponent)})`;

    return forwardRef(WithViewportOffsetTop);
}

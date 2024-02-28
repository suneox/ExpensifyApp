import { useEffect, useRef, useState } from 'react';
import addViewportResizeListener from '@libs/VisualViewport';

export default function useViewportOffsetTop(shouldAdjustScrollView = false): number {
    const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
    const initialHeight = useRef(window.visualViewport?.height ?? window.innerHeight).current;
    const cachedDefaultOffsetTop = useRef<number>(0);
    useEffect(() => {
        const updateDimensions = (event: Event) => {
            const targetOffsetTop = (event.target instanceof VisualViewport && event.target.offsetTop) || 0;
            if (shouldAdjustScrollView && window.visualViewport) {
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
            } else {
                setViewportOffsetTop(targetOffsetTop);
            }
        };

        const removeViewportResizeListener = addViewportResizeListener(updateDimensions);

        return () => {
            removeViewportResizeListener();
        };
    }, [initialHeight, shouldAdjustScrollView]);

    useEffect(() => {
        if (!shouldAdjustScrollView) {
            return;
        }
        window.scrollTo({top: viewportOffsetTop});
    }, [shouldAdjustScrollView, viewportOffsetTop]);

    return viewportOffsetTop;
}

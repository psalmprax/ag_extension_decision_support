import { useEffect, useRef, useState } from 'react';
import { isWebGLAvailable } from './webgl';
import type { Stage } from './stage';

/** What a scene module hands back: a way to change its inputs after it is built. */
export interface SceneController<P> {
  update: (params: P) => void;
  dispose?: () => void;
}

/** Builds a scene on a stage. Loaded with a dynamic import so three.js stays out of page bundles. */
export type SceneFactory<P> = (container: HTMLElement, params: P) => { stage: Stage; controller: SceneController<P> };

export type SceneStatus = 'loading' | 'ready' | 'unsupported' | 'error';

/**
 * Mounts a three.js scene into the returned container ref once WebGL is known to work,
 * forwards later parameter changes to it, and tears everything down on unmount.
 */
export function useThreeScene<P>(load: () => Promise<SceneFactory<P>>, params: P) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SceneController<P> | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const loadRef = useRef(load);
  const [status, setStatus] = useState<SceneStatus>(() => (isWebGLAvailable() ? 'loading' : 'unsupported'));

  useEffect(() => {
    if (status === 'unsupported') return undefined;
    let cancelled = false;
    let stage: Stage | null = null;
    loadRef
      .current()
      .then(factory => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        const built = factory(container, paramsRef.current);
        stage = built.stage;
        controllerRef.current = built.controller;
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) console.warn('3D view could not start:', error);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose?.();
      controllerRef.current = null;
      stage?.dispose();
    };
    // The scene is built once; later changes arrive through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controllerRef.current?.update(params);
  }, [params]);

  return { containerRef, status };
}

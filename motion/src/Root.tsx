import React from 'react';
import {Composition} from 'remotion';
import {DracoCoreVideo, DRACO_CORE_FPS, DRACO_CORE_FRAMES} from './DracoCoreVideo';

export const Root: React.FC = () => {
  return (
    <Composition
      id="DracoCoreVideo"
      component={DracoCoreVideo}
      width={1920}
      height={1080}
      fps={DRACO_CORE_FPS}
      durationInFrames={DRACO_CORE_FRAMES}
      defaultProps={{}}
    />
  );
};

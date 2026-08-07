import React from 'react';

interface FocusBuildProps {
  totalPomodoros: number;
}

const BLOCKS_PER_BUILD = 16;
const BLOCKS_PER_FLOOR = 4;

export const FocusBuild: React.FC<FocusBuildProps> = ({ totalPomodoros }) => {
  const remainder = totalPomodoros % BLOCKS_PER_BUILD;
  const completedBuilds = Math.floor(totalPomodoros / BLOCKS_PER_BUILD);
  const isAtBoundary = totalPomodoros > 0 && remainder === 0;
  const filledBlocks = isAtBoundary ? BLOCKS_PER_BUILD : remainder;
  const buildNumber = isAtBoundary ? completedBuilds : completedBuilds + 1;
  const completedFloors = Math.floor(filledBlocks / BLOCKS_PER_FLOOR);

  return (
    <aside className="focus-build" aria-label={`${filledBlocks} of ${BLOCKS_PER_BUILD} focus blocks placed`}>
      <header className="focus-build-header">
        <div>
          <p className="eyebrow">Focus build</p>
          <h3>Structure {buildNumber.toString().padStart(2, '0')}</h3>
        </div>
        <span>{filledBlocks}/{BLOCKS_PER_BUILD}</span>
      </header>

      <div className="focus-build-canvas" aria-hidden="true">
        <div className="focus-build-grid">
          {Array.from({ length: BLOCKS_PER_BUILD }, (_, index) => (
            <span
              key={index}
              className={`focus-block focus-block-${index % BLOCKS_PER_FLOOR} ${index >= BLOCKS_PER_BUILD - filledBlocks ? 'focus-block-filled' : ''}`}
            />
          ))}
        </div>
        <span className="focus-build-ground" />
      </div>

      <div className="focus-build-stats">
        <span><b>{completedFloors}</b> floors</span>
        <span><b>{completedBuilds}</b> builds finished</span>
      </div>
      <p>Finish one Pomodoro to place a block. Four blocks complete a floor.</p>
    </aside>
  );
};

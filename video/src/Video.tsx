import React from "react";
import { Audio, Sequence, Series, staticFile } from "remotion";
import narration from "./narration.json";
import durations from "./durations.json";
import { Shell, Subtitles } from "./theme";
import * as S from "./scenes";

export const FPS = 30;
const LEAD = 8;   // frames of silence before narration starts in each scene
const TAIL = 24;  // frames after narration ends

const SCENES: Record<string, React.FC<{ dur: number }>> = {
  title: S.TitleScene, layers: S.LayersScene, loop: S.LoopScene, puzzle: S.PuzzleScene,
  models: S.ModelsScene, accuracy: S.AccuracyScene, staircase: S.StaircaseScene, lens: S.LensScene,
  overthink: S.OverthinkScene, cures: S.CuresScene, harder: S.HarderScene, cost: S.CostScene,
  receipts: S.ReceiptsScene, outro: S.OutroScene,
};

export const sceneFrames = (id: string) =>
  Math.ceil(((durations as Record<string, number>)[id] ?? 5) * FPS) + LEAD + TAIL;

export const totalFrames = () => narration.reduce((s, n) => s + sceneFrames(n.id), 0);

export const Explainer: React.FC = () => (
  <Series>
    {narration.map(({ id, text }) => {
      const dur = sceneFrames(id);
      const Scene = SCENES[id];
      return (
        <Series.Sequence key={id} durationInFrames={dur}>
          <Shell dur={dur}>
            <Scene dur={dur} />
            <Subtitles text={text} dur={dur} lead={LEAD} />
          </Shell>
          <Sequence from={LEAD} durationInFrames={dur - LEAD} layout="none">
            <Audio src={staticFile(`audio/${id}.wav`)} />
          </Sequence>
        </Series.Sequence>
      );
    })}
  </Series>
);

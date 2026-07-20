import type { CampaignMode } from './campaignTypes';

const hashSeed = (chapterNumber: number, mode: CampaignMode, totalAttacks: number): number => {
  const input = `${chapterNumber}:${mode}:${totalAttacks}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x6d2b79f5;
};

export const createCampaignCombatRandom = (
  chapterNumber: number,
  mode: CampaignMode,
  totalAttacks = 0,
): (() => number) => {
  let state = hashSeed(chapterNumber, mode, totalAttacks);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
};

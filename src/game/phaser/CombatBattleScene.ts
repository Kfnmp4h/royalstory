import { BattleScene } from './BattleScene';
import { preloadCombatEffects, registerCombatAnimations } from './combatPresentation/combatAssets';

export class CombatBattleScene extends BattleScene {
  preload(): void {
    preloadCombatEffects(this.load);
  }

  override create(): void {
    registerCombatAnimations(this.anims);
    super.create();
  }
}

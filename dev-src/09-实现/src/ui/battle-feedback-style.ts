export const BATTLE_FEEDBACK_STYLE = `
.rpg-battle[data-action-side="enemy"] .rpg-battle-log{border-left:3px solid #e28176;background:linear-gradient(90deg,#401b24ec,#221620bd 72%,transparent)}
.rpg-battle[data-action-side="ally"] .rpg-battle-log{border-left-color:#d7be85}
.rpg-battle .rpg-damage{animation-delay:var(--rpg-impact-delay,0s);animation-duration:calc(.75s / var(--rpg-speed,1))}
.rpg-battle .rpg-damage.critical{color:#ffd483;font-size:clamp(29px,5.4cqh,52px);text-shadow:-2px -2px #34202a,2px 2px #34202a,0 0 12px #d6794055}
.rpg-battle .rpg-damage.response{top:12%;font-size:clamp(16px,2.8cqh,28px);letter-spacing:2px;color:#c9e6f4}
.rpg-battle .rpg-damage.block{color:#d3d9ed}
.rpg-battle .rpg-hit,.rpg-battle .rpg-evading{animation-delay:var(--rpg-impact-delay,0s)}
.rpg-battle.is-flashing::after{animation-delay:var(--rpg-impact-delay,0s)}
.rpg-battle .rpg-evading{animation-name:rpg-evade;animation-duration:calc(.32s / var(--rpg-speed,1));animation-timing-function:ease-out}
@keyframes rpg-evade{0%,100%{transform:translateX(0)}40%{transform:translateX(14px)}70%{transform:translateX(6px)}}
@media(prefers-reduced-motion:reduce){.rpg-battle .rpg-hit,.rpg-battle .rpg-evading,.rpg-battle .rpg-attacking .rpg-enemy-art{animation:none!important}.rpg-battle.is-flashing::after{display:none}}
`;

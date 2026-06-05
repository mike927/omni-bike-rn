# App icon — "Spoke Burst" (concept 07)

Canonical vector sources for the omni-bike launcher icon. Calm Noir palette
(`#0b0e13` bg, aurora `#2e3dff → #8b5cf6 → #10b5a4` rays, `#4fd8c8` hub dot).

| File | Role |
| --- | --- |
| `icon-07-spoke-burst.svg` | Full-bleed master → rendered to `assets/icon.png` (iOS + general / install icon) |
| `adaptive-foreground.svg` | Android adaptive **foreground**, transparent, content inside the 66.7% safe zone → `assets/adaptive-icon.png`. Background colour is set to `#0b0e13` in `app.config.ts` (`android.adaptiveIcon.backgroundColor`). |

## Re-render the PNGs

```bash
npm i -D @resvg/resvg-js
node -e "const{Resvg}=require('@resvg/resvg-js'),fs=require('fs');for(const[svg,out]of[['icon-07-spoke-burst.svg','../../assets/icon.png'],['adaptive-foreground.svg','../../assets/adaptive-icon.png']])fs.writeFileSync(out,new Resvg(fs.readFileSync(svg,'utf8'),{fitTo:{mode:'width',value:1024},background:'rgba(0,0,0,0)'}).render().asPng())"
```

Edit the `.svg` source, re-run, then rebuild the native app (`expo prebuild` / EAS build)
for the new icon to appear at install.

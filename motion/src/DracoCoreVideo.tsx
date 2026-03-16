import React from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const DRACO_CORE_FPS = 30;
const SCENE_DURATION = 105;
export const DRACO_CORE_FRAMES = SCENE_DURATION * 6;

const palette = {
  bg: '#ffffff',
  text: '#111318',
  muted: '#606775',
  line: 'rgba(17, 19, 24, 0.08)',
  lineStrong: 'rgba(17, 19, 24, 0.14)',
  blue: '#0071e3',
  orange: '#ff9f55',
  green: '#2aa35e',
  red: '#d3403b',
  sky: '#62a9ff',
  card: '#ffffff',
  cardAlt: '#f7f7f9',
  shadow: '0 30px 80px rgba(17, 19, 24, 0.08), 0 10px 24px rgba(17, 19, 24, 0.04)',
};

const sceneMeta = [
  {
    title: 'Design knowledge stays scattered',
    subtitle: 'Research findings, guidelines, and tools rarely arrive as one operational system.',
  },
  {
    title: 'Draco formalizes design knowledge',
    subtitle: 'Data and partial intent become facts, then combine with hard and soft constraints.',
  },
  {
    title: 'Hard constraints prune the design space',
    subtitle: 'Invalid and non-expressive charts are removed before ranking even begins.',
  },
  {
    title: 'Soft constraints rank what remains',
    subtitle: 'Valid candidates still differ in cost, so Draco can surface the stronger choices first.',
  },
  {
    title: 'Learned weights update preferences',
    subtitle: 'Experimental evidence changes the strength of soft rules without changing the whole system.',
  },
  {
    title: 'Draco is actionable and extensible',
    subtitle: 'New rules plug into the knowledge base, and recommendations update as the model evolves.',
  },
] as const;

const chartPoints = [
  [0.16, 0.28],
  [0.22, 0.34],
  [0.28, 0.42],
  [0.32, 0.5],
  [0.38, 0.46],
  [0.42, 0.56],
  [0.5, 0.62],
  [0.56, 0.66],
  [0.63, 0.72],
  [0.72, 0.78],
  [0.78, 0.74],
] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const tint = (hex: string, alpha: number) => {
  const source = hex.replace('#', '');
  const normalized = source.length === 3 ? source.split('').map((segment) => segment + segment).join('') : source;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const entrance = (fps: number, frame: number, delay = 0, damping = 180, stiffness = 120) =>
  clamp(
    spring({
      fps,
      frame: frame - delay,
      config: {damping, stiffness},
    }),
    0,
    1,
  );

const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  position: 'absolute',
  borderRadius: 34,
  border: `1px solid ${palette.line}`,
  background: palette.card,
  boxShadow: palette.shadow,
  overflow: 'hidden',
  ...extra,
});

const pillStyle = (color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 36,
  padding: '0 16px',
  borderRadius: 999,
  border: `1px solid ${tint(color, 0.16)}`,
  background: tint(color, 0.08),
  color,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  ...extra,
});

const SceneChrome: React.FC<{
  sceneIndex: number;
  opacity: number;
  title: string;
  subtitle: string;
}> = ({sceneIndex, opacity, title, subtitle}) => {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 84,
          opacity,
          transform: `translateY(${interpolate(opacity, [0, 1], [26, 0])}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={pillStyle(palette.blue)}>Scene {String(sceneIndex + 1).padStart(2, '0')}</div>
          <div style={{width: 84, height: 1, background: palette.lineStrong}} />
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: palette.muted,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Draco / Key Idea
          </div>
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 84,
            fontWeight: 700,
            letterSpacing: '-0.055em',
            lineHeight: 0.94,
            color: palette.text,
            maxWidth: 1160,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 22,
            fontSize: 24,
            lineHeight: 1.34,
            color: palette.muted,
            maxWidth: 1360,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 120,
          top: 98,
          display: 'flex',
          gap: 12,
          opacity,
        }}
      >
        {sceneMeta.map((_scene, index) => (
          <div
            key={index}
            style={{
              width: 34,
              height: 4,
              borderRadius: 999,
              background: index === sceneIndex ? palette.text : 'rgba(17, 19, 24, 0.08)',
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 306,
          width: 280,
          height: 2,
          borderRadius: 999,
          background: palette.text,
          opacity: opacity * 0.12,
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: 92,
          bottom: 18,
          fontSize: 320,
          lineHeight: 0.9,
          fontWeight: 700,
          letterSpacing: '-0.08em',
          color: 'rgba(17, 19, 24, 0.035)',
          opacity,
          userSelect: 'none',
        }}
      >
        {String(sceneIndex + 1).padStart(2, '0')}
      </div>
    </>
  );
};

const Background: React.FC = () => {
  return (
    <AbsoluteFill style={{background: palette.bg}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 78%, rgba(246,247,249,1) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          top: 48,
          bottom: 48,
          borderRadius: 36,
          border: `1px solid ${palette.line}`,
          opacity: 0.36,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 72,
          height: 1,
          background: palette.line,
        }}
      />
    </AbsoluteFill>
  );
};

const FloatingCard: React.FC<{
  title: string;
  lines: string[];
  x: number;
  y: number;
  width: number;
  accent: string;
  opacity: number;
  rotate?: number;
}> = ({title, lines, x, y, width, accent, opacity, rotate = 0}) => {
  return (
    <div
      style={{
        ...cardStyle({
          left: x,
          top: y,
          width,
          height: 228,
          padding: '26px 28px',
          opacity,
          transform: `translateY(${interpolate(opacity, [0, 1], [30, 0])}px) rotate(${rotate}deg)`,
        }),
      }}
    >
      <div style={pillStyle(accent)}>{title}</div>
      <div style={{marginTop: 22, display: 'grid', gap: 12}}>
        {lines.map((line) => (
          <div key={line} style={{fontSize: 20, lineHeight: 1.38, color: palette.muted}}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};

const Connector: React.FC<{
  from: [number, number];
  to: [number, number];
  progress: number;
  color: string;
  dashed?: boolean;
  opacity?: number;
  strokeWidth?: number;
}> = ({from, to, progress, color, dashed = false, opacity = 1, strokeWidth = 5}) => {
  const x1 = from[0];
  const y1 = from[1];
  const x2 = lerp(from[0], to[0], progress);
  const y2 = lerp(from[1], to[1], progress);
  const arrowVisible = progress > 0.98;

  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, opacity, overflow: 'visible'}}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashed ? '14 14' : undefined}
      />
      {arrowVisible ? (
        <polygon
          points={`${to[0]},${to[1]} ${to[0] - 22},${to[1] - 11} ${to[0] - 22},${to[1] + 11}`}
          fill={color}
        />
      ) : null}
    </svg>
  );
};

const MiniChart: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  selected?: boolean;
  label?: string;
  cost?: string;
  muted?: boolean;
}> = ({x, y, width, height, opacity, selected = false, label, cost, muted = false}) => {
  return (
    <div
      style={{
        ...cardStyle({
          left: x,
          top: y,
          width,
          height,
          padding: '18px 18px 16px',
          opacity,
          borderColor: selected ? tint(palette.blue, 0.2) : palette.line,
          boxShadow: selected ? `0 0 0 4px ${tint(palette.blue, 0.08)}, ${palette.shadow}` : palette.shadow,
          background: muted ? palette.cardAlt : palette.card,
        }),
      }}
    >
      {label ? (
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
          <div style={{fontSize: 18, fontWeight: 700, color: palette.text}}>{label}</div>
          {cost ? <div style={{fontSize: 15, fontWeight: 700, color: selected ? palette.blue : palette.muted}}>{cost}</div> : null}
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: label ? height - 64 : height - 36,
          borderRadius: 22,
          border: `1px solid ${palette.line}`,
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[20, 40, 60, 80].map((p) => (
            <line key={`h-${p}`} x1="8" x2="94" y1={p} y2={p} stroke="rgba(17,19,24,0.08)" strokeWidth="1" />
          ))}
          {[24, 44, 64, 84].map((p) => (
            <line key={`v-${p}`} y1="8" y2="92" x1={p} x2={p} stroke="rgba(17,19,24,0.08)" strokeWidth="1" />
          ))}
          {chartPoints.map(([px, py], index) => (
            <circle
              key={`${px}-${py}`}
              cx={8 + px * 86}
              cy={8 + py * 84}
              r="2.6"
              fill="rgba(255,255,255,0.96)"
              stroke={selected && index % 3 === 0 ? palette.orange : palette.sky}
              strokeWidth="1.5"
            />
          ))}
        </svg>
      </div>
    </div>
  );
};

const SceneOne: React.FC<{fps: number; localFrame: number}> = ({fps, localFrame}) => {
  const left = entrance(fps, localFrame, 2);
  const mid = entrance(fps, localFrame, 8);
  const right = entrance(fps, localFrame, 12);

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 864,
          top: 424,
          fontSize: 178,
          lineHeight: 0.88,
          letterSpacing: '-0.08em',
          fontWeight: 700,
          color: 'rgba(17, 19, 24, 0.045)',
          opacity: clamp(localFrame / 16, 0, 1),
        }}
      >
        GAP
      </div>
      <FloatingCard
        title="studies"
        lines={['graphical perception', 'task effectiveness', 'data characteristics']}
        x={148}
        y={370}
        width={330}
        accent={palette.blue}
        opacity={left}
        rotate={-2}
      />
      <FloatingCard
        title="guidelines"
        lines={['expressiveness', 'zero baseline', 'channel preference']}
        x={424}
        y={616}
        width={346}
        accent={palette.orange}
        opacity={mid}
        rotate={2}
      />
      <FloatingCard
        title="tools"
        lines={['recommenders', 'interactive editors', 'production constraints']}
        x={1266}
        y={466}
        width={348}
        accent={palette.green}
        opacity={right}
      />
      <Connector
        from={[790, 518]}
        to={[1196, 518]}
        progress={entrance(fps, localFrame, 16, 170, 100)}
        color="rgba(17,19,24,0.22)"
        dashed
      />
    </>
  );
};

const SceneTwo: React.FC<{fps: number; localFrame: number}> = ({fps, localFrame}) => {
  const left = entrance(fps, localFrame, 2);
  const center = entrance(fps, localFrame, 10);
  const right = entrance(fps, localFrame, 18);

  return (
    <>
      <FloatingCard
        title="dataset"
        lines={['field types', 'cardinality', 'schema statistics']}
        x={122}
        y={372}
        width={288}
        accent={palette.orange}
        opacity={left}
      />
      <FloatingCard
        title="partial spec"
        lines={['known fields', 'known channels', 'missing decisions']}
        x={162}
        y={632}
        width={318}
        accent={palette.blue}
        opacity={entrance(fps, localFrame, 6)}
      />
      <Connector from={[430, 486]} to={[654, 486]} progress={entrance(fps, localFrame, 10)} color={palette.text} />
      <Connector from={[482, 708]} to={[654, 630]} progress={entrance(fps, localFrame, 14)} color={palette.text} />
      <div
        style={{
          ...cardStyle({
            left: 686,
            top: 348,
            width: 566,
            height: 434,
            padding: '30px 32px',
            opacity: center,
          }),
        }}
      >
        <div style={pillStyle(palette.blue)}>Draco engine</div>
        <div style={{marginTop: 18, fontSize: 50, fontWeight: 700, lineHeight: 0.96, letterSpacing: '-0.05em', color: palette.text}}>
          Facts + rules + preferences
        </div>
        <div style={{marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
          <div style={pillStyle(palette.orange)}>logical facts</div>
          <div style={pillStyle(palette.blue)}>hard constraints</div>
          <div style={pillStyle(palette.green)}>soft constraints</div>
        </div>
        <div style={{marginTop: 28, display: 'grid', gap: 14}}>
          {['data representation', 'grammar and expressiveness', 'weighted ranking model'].map((item) => (
            <div key={item} style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, color: palette.muted}}>
              <div style={{width: 10, height: 10, borderRadius: 999, background: palette.text}} />
              {item}
            </div>
          ))}
        </div>
      </div>
      <Connector from={[1268, 560]} to={[1464, 560]} progress={entrance(fps, localFrame, 24)} color={palette.blue} />
      <div
        style={{
          ...cardStyle({
            left: 1488,
            top: 392,
            width: 256,
            height: 334,
            padding: '24px 22px',
            opacity: right,
          }),
        }}
      >
        <div style={{fontSize: 14, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: palette.blue}}>Output</div>
        <div style={{marginTop: 16, fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', color: palette.text}}>Ranked specs</div>
        <div style={{marginTop: 22, display: 'grid', gap: 12}}>
          {['candidate set', 'cost ordering', 'Vega-Lite output'].map((item, index) => (
            <div
              key={item}
              style={{
                borderRadius: 20,
                border: `1px solid ${palette.line}`,
                background: index === 1 ? palette.cardAlt : palette.card,
                padding: '14px 16px',
                fontSize: 17,
                color: palette.muted,
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const SceneThree: React.FC<{fps: number; localFrame: number}> = ({fps, localFrame}) => {
  const reveal = entrance(fps, localFrame, 6);
  const reject = entrance(fps, localFrame, 16);
  const cards = [
    {x: 176, y: 386, dead: true},
    {x: 476, y: 386, dead: false},
    {x: 776, y: 386, dead: true},
    {x: 1076, y: 386, dead: false},
    {x: 1376, y: 386, dead: false},
  ];

  return (
    <>
      <div style={{...pillStyle(palette.blue, {position: 'absolute', left: 120, top: 372})}}>hard constraints</div>
      {cards.map((card, index) => (
        <MiniChart
          key={index}
          x={card.x}
          y={card.y}
          width={228}
          height={222}
          opacity={card.dead ? 1 - reject * 0.78 : clamp(0.28 + reveal, 0, 1)}
          muted={card.dead}
        />
      ))}
      {cards
        .filter((card) => card.dead)
        .map((card, index) => (
          <svg key={index} width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, opacity: reject}}>
            <line
              x1={card.x + 40}
              y1={card.y + 42}
              x2={card.x + 188}
              y2={card.y + 178}
              stroke={palette.red}
              strokeWidth={10}
              strokeLinecap="round"
            />
            <line
              x1={card.x + 188}
              y1={card.y + 42}
              x2={card.x + 40}
              y2={card.y + 178}
              stroke={palette.red}
              strokeWidth={10}
              strokeLinecap="round"
            />
          </svg>
        ))}
      <div style={{position: 'absolute', left: 178, top: 634, fontSize: 18, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: palette.red, opacity: reject}}>invalid</div>
      <div style={{position: 'absolute', left: 1328, top: 634, fontSize: 18, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: palette.green, opacity: reveal}}>survive</div>
      <Connector from={[348, 700]} to={[1562, 700]} progress={entrance(fps, localFrame, 22)} color={palette.text} strokeWidth={4} opacity={0.18} />
    </>
  );
};

const SceneFour: React.FC<{fps: number; localFrame: number}> = ({fps, localFrame}) => {
  const reveal = entrance(fps, localFrame, 8);
  const costs = [0.34, 0.56, 0.82];

  return (
    <>
      <div style={{...pillStyle(palette.green, {position: 'absolute', left: 120, top: 370})}}>soft constraints</div>
      <Connector from={[328, 388]} to={[508, 388]} progress={entrance(fps, localFrame, 12)} color={palette.text} />
      {[0, 1, 2].map((index) => (
        <React.Fragment key={index}>
          <MiniChart
            x={516 + index * 346}
            y={356 + index * 20}
            width={300}
            height={284}
            opacity={reveal}
            selected={index === 0}
            label={`candidate ${index + 1}`}
            cost={index === 0 ? 'cost 12' : index === 1 ? 'cost 14' : 'cost 18'}
          />
          <div
            style={{
              position: 'absolute',
              left: 550 + index * 346,
              top: 666 + index * 20,
              width: 232,
              height: 16,
              borderRadius: 999,
              background: tint(palette.text, 0.08),
              overflow: 'hidden',
              opacity: reveal,
            }}
          >
            <div
              style={{
                width: `${costs[index] * 100}%`,
                height: '100%',
                borderRadius: 999,
                background: index === 0 ? `linear-gradient(90deg, ${palette.orange}, ${palette.blue})` : tint(palette.text, 0.16),
              }}
            />
          </div>
        </React.Fragment>
      ))}
      <div style={{position: 'absolute', left: 550, top: 714, fontSize: 22, fontWeight: 700, color: palette.blue, opacity: reveal}}>lower cost → stronger recommendation</div>
    </>
  );
};

const SceneFive: React.FC<{fps: number; localFrame: number}> = ({fps, localFrame}) => {
  const left = entrance(fps, localFrame, 4);
  const center = entrance(fps, localFrame, 10);
  const right = entrance(fps, localFrame, 16);
  const knobs = [
    interpolate(center, [0, 1], [0.18, 0.76]),
    interpolate(center, [0, 1], [0.32, 0.62]),
    interpolate(center, [0, 1], [0.56, 0.24]),
    interpolate(center, [0, 1], [0.26, 0.72]),
  ];

  return (
    <>
      <FloatingCard
        title="experiments"
        lines={['accuracy', 'response time', 'task effects']}
        x={134}
        y={418}
        width={300}
        accent={palette.orange}
        opacity={left}
      />
      <Connector from={[448, 532]} to={[626, 532]} progress={entrance(fps, localFrame, 8)} color={palette.text} />
      <div
        style={{
          ...cardStyle({
            left: 648,
            top: 350,
            width: 532,
            height: 392,
            padding: '30px 30px',
            opacity: center,
          }),
        }}
      >
        <div style={pillStyle(palette.blue)}>weight learning</div>
        <div style={{marginTop: 18, fontSize: 50, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.96, color: palette.text}}>
          Preference strength updates
        </div>
        {['x for quantitative', 'binning preference', 'summary tasks', 'color for categories'].map((label, index) => (
          <div key={label} style={{marginTop: 28}}>
            <div style={{fontSize: 18, color: palette.muted, marginBottom: 10}}>{label}</div>
            <div style={{position: 'relative', width: '100%', height: 14, borderRadius: 999, background: tint(palette.text, 0.08)}}>
              <div
                style={{
                  position: 'absolute',
                  left: `${knobs[index] * 100}%`,
                  top: -6,
                  width: 26,
                  height: 26,
                  marginLeft: -13,
                  borderRadius: 999,
                  background: palette.blue,
                  boxShadow: `0 12px 24px ${tint(palette.blue, 0.24)}`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <Connector from={[1200, 532]} to={[1370, 532]} progress={entrance(fps, localFrame, 18)} color={palette.blue} />
      <MiniChart x={1386} y={424} width={348} height={252} opacity={right} selected label="updated model" cost="better fit" />
    </>
  );
};

const SceneSix: React.FC<{fps: number; localFrame: number}> = ({fps, localFrame}) => {
  const reveal = entrance(fps, localFrame, 4);
  const plug = entrance(fps, localFrame, 14);
  const shift = interpolate(plug, [0, 1], [0, -32]);

  return (
    <>
      <div
        style={{
          ...cardStyle({
            left: 126,
            top: 412,
            width: 348,
            height: 308,
            padding: '28px 28px',
            opacity: reveal,
          }),
        }}
      >
        <div style={pillStyle(palette.orange)}>new rule</div>
        <div style={{marginTop: 18, fontSize: 40, fontWeight: 700, lineHeight: 0.96, letterSpacing: '-0.05em', color: palette.text}}>
          Change rules, not the whole engine
        </div>
        <div style={{marginTop: 14, fontSize: 18, lineHeight: 1.42, color: palette.muted}}>One more constraint updates the model without rebuilding the entire workflow.</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: interpolate(plug, [0, 1], [444, 560]),
          top: 496,
          width: 54,
          height: 96,
          borderRadius: 20,
          background: `linear-gradient(180deg, ${palette.blue}, #0a84ff)`,
          boxShadow: `0 20px 40px ${tint(palette.blue, 0.22)}`,
          opacity: plug,
        }}
      >
        <div style={{position: 'absolute', right: -12, top: 24, width: 12, height: 12, borderRadius: 999, background: palette.blue}} />
        <div style={{position: 'absolute', right: -12, top: 58, width: 12, height: 12, borderRadius: 999, background: palette.blue}} />
      </div>
      <Connector from={[518, 544]} to={[666, 544]} progress={entrance(fps, localFrame, 18)} color={palette.text} />
      <div
        style={{
          ...cardStyle({
            left: 688,
            top: 372,
            width: 492,
            height: 372,
            padding: '30px 32px',
            opacity: plug,
          }),
        }}
      >
        <div style={pillStyle(palette.blue)}>Draco knowledge base</div>
        <div style={{marginTop: 18, fontSize: 52, fontWeight: 700, lineHeight: 0.94, letterSpacing: '-0.055em', color: palette.text}}>
          Actionable. Extensible.
        </div>
        <div style={{marginTop: 28, display: 'grid', gap: 14}}>
          {['explicit rules', 'testable trade-offs', 'shared design knowledge'].map((item) => (
            <div key={item} style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, color: palette.muted}}>
              <div style={{width: 10, height: 10, borderRadius: 999, background: palette.green}} />
              {item}
            </div>
          ))}
        </div>
      </div>
      <Connector from={[1194, 544]} to={[1362, 544]} progress={entrance(fps, localFrame, 22)} color={palette.green} />
      <div style={{transform: `translateY(${shift}px)`}}>
        <MiniChart x={1374} y={384} width={360} height={246} opacity={plug} label="before update" cost="cost 15" />
        <MiniChart x={1374} y={658} width={360} height={246} opacity={plug} selected label="after update" cost="cost 11" />
      </div>
    </>
  );
};

export const DracoCoreVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{fontFamily: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'}}>
      <Background />
      {sceneMeta.map((scene, index) => {
        const start = index * SCENE_DURATION;
        const localFrame = frame - start;
        const visible = localFrame >= 0 && localFrame < SCENE_DURATION;

        if (!visible) {
          return null;
        }

        const opacity = interpolate(localFrame, [0, 14, SCENE_DURATION - 16, SCENE_DURATION - 1], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        });
        const shiftY = interpolate(localFrame, [0, 14, SCENE_DURATION - 16, SCENE_DURATION - 1], [28, 0, 0, -18], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const scale = interpolate(localFrame, [0, 14, SCENE_DURATION - 16, SCENE_DURATION - 1], [0.986, 1, 1, 1.006], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <AbsoluteFill
            key={scene.title}
            style={{
              opacity,
              transform: `translateY(${shiftY}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            <SceneChrome sceneIndex={index} opacity={opacity} title={scene.title} subtitle={scene.subtitle} />

            {index === 0 ? <SceneOne fps={fps} localFrame={localFrame} /> : null}
            {index === 1 ? <SceneTwo fps={fps} localFrame={localFrame} /> : null}
            {index === 2 ? <SceneThree fps={fps} localFrame={localFrame} /> : null}
            {index === 3 ? <SceneFour fps={fps} localFrame={localFrame} /> : null}
            {index === 4 ? <SceneFive fps={fps} localFrame={localFrame} /> : null}
            {index === 5 ? <SceneSix fps={fps} localFrame={localFrame} /> : null}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

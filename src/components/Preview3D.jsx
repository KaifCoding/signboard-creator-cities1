'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useStore } from '../store/useStore.js';
import { buildSignMesh } from '../lib/geometry.js';
import { buildSpec } from '../lib/exportClient.js';
import { registry, renderDesign } from '../lib/registry.js';
import { composeAtlas } from '../lib/atlas.js';

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    return () => { scene.environment = null; tex.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

function SignModel({ structure, maps, wireframe }) {
  const spec = useMemo(() => buildSpec(structure), [structure.kind, structure.board, structure.poles, structure.flag]);
  const mesh = useMemo(() => buildSignMesh(spec), [spec]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);
  useEffect(() => () => geom.dispose(), [geom]);

  // Persistent textures: created once at final size and only their canvas is swapped on updates
  // (re-creating/disposing textures on every edit is wasteful and can race with GPU uploads).
  const tex = useMemo(() => {
    const blank = (n, col) => { const c = document.createElement('canvas'); c.width = n; c.height = n; const g = c.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, n, n); return c; };
    const c = new THREE.CanvasTexture(blank(1024, '#ffffff')); c.colorSpace = THREE.SRGBColorSpace; c.anisotropy = 8; c.generateMipmaps = true; c.minFilter = THREE.LinearMipmapLinearFilter;
    const m = new THREE.CanvasTexture(blank(64, 'rgb(0,128,64)'));
    const e = new THREE.CanvasTexture(blank(1024, '#000000')); e.colorSpace = THREE.SRGBColorSpace;
    return { c, m, e };
  }, []);
  useEffect(() => () => { tex.c.dispose(); tex.m.dispose(); tex.e.dispose(); }, [tex]);
  useEffect(() => {
    if (!maps) return;
    tex.c.image = maps.color; tex.c.needsUpdate = true;
    tex.m.image = maps.mr; tex.m.needsUpdate = true;
    tex.e.image = maps.emissive; tex.e.needsUpdate = true;
  }, [maps, tex]);

  const fin = structure.finish;
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshPhysicalMaterial
        map={tex.c} roughnessMap={tex.m} metalnessMap={tex.m} roughness={1} metalness={1}
        clearcoat={fin.reflectivity * 0.3} clearcoatRoughness={0.25 + fin.roughness * 0.4}
        emissive={structure.illuminated ? '#ffffff' : '#000000'} emissiveMap={tex.e} emissiveIntensity={structure.illuminated ? 1.1 : 0}
        envMapIntensity={0.55} wireframe={wireframe} color={maps ? '#ffffff' : '#888888'}
      />
    </mesh>
  );
}

function Rig({ bbox, view, nonce }) {
  const controls = useRef();
  const { camera, size: vp } = useThree();
  useEffect(() => {
    const [mn, mx] = [bbox.min, bbox.max];
    const c = new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    const t = Math.tan((camera.fov * Math.PI) / 360), aspect = vp.width / Math.max(1, vp.height);
    const halfW = Math.max(mx[0] - mn[0], 0.5) / 2 * 1.18, halfH = Math.max(mx[1] - mn[1], 0.5) / 2 * 1.18;
    const d = Math.max(halfH / t, halfW / (t * aspect)) + Math.max(mx[2] - mn[2], 0.2) / 2 + 0.5;
    const dirs = { persp: [0.55, 0.22, 1], front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.001] };
    const v = new THREE.Vector3(...(dirs[view] || dirs.persp)).normalize().multiplyScalar(d);
    camera.position.copy(c).add(v);
    camera.near = 0.05; camera.far = 500; camera.updateProjectionMatrix();
    if (controls.current) { controls.current.target.copy(c); controls.current.update(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, nonce]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI * 0.98} />;
}

function Human({ x }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.8, 0]} castShadow><capsuleGeometry args={[0.2, 1.0, 4, 12]} /><meshStandardMaterial color="#6b7a90" roughness={0.8} /></mesh>
      <mesh position={[0, 1.66, 0]} castShadow><sphereGeometry args={[0.11, 16, 12]} /><meshStandardMaterial color="#6b7a90" roughness={0.8} /></mesh>
    </group>
  );
}

export default function Preview3D({ active }) {
  const structure = useStore((s) => s.project.structure);
  const atlasVersion = useStore((s) => s.atlasVersion);
  const [maps, setMaps] = useState(null);
  const [view, setView] = useState('persp');
  const [nonce, setNonce] = useState(0);
  const [opts, setOpts] = useState({ ground: true, human: true, wire: false });
  const glRef = useRef(null);

  const mesh = useMemo(() => buildSignMesh(buildSpec(structure)), [structure.kind, structure.board, structure.poles, structure.flag]);
  useEffect(() => { setNonce((n) => n + 1); }, [structure.kind, structure.board.widthM, structure.board.heightM]);

  const colorKey = [structure.board.frame.color, structure.poles.color, structure.board.backColor, structure.finish.roughness, structure.finish.metalness, structure.illuminated].join('|');
  useEffect(() => {
    if (!active) return;
    let tries = 0, timer;
    const run = () => {
      try {
        const d = renderDesign(1024);
        const m = composeAtlas(d, structure, 1024);
        if (typeof window !== 'undefined' && window.__sbc) window.__sbc.maps = m;
        setMaps(m);
      } catch (e) { if (tries++ < 20) timer = setTimeout(run, 150); }
    };
    timer = setTimeout(run, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlasVersion, colorKey, active]);

  const snapshot = () => {
    const gl = glRef.current; if (!gl) return;
    const a = document.createElement('a');
    a.href = gl.domElement.toDataURL('image/png'); a.download = 'signboard-preview.png'; a.click();
  };

  const Btn = ({ id, children }) => (
    <button onClick={() => { setView(id); setNonce((n) => n + 1); }} className={`rounded px-2 py-1 text-[11px] ${view === id ? 'bg-saffron text-black' : 'bg-ink-700 text-slate-300 hover:bg-ink-600'}`}>{children}</button>
  );
  const Tog = ({ k, children }) => (
    <label className="flex cursor-pointer items-center gap-1 text-[11px] text-slate-300"><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />{children}</label>
  );
  const w = structure.board.widthM, h = structure.board.heightM;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-[#0c0f14]">
      <div className="min-h-0 flex-1">
        <Canvas shadows dpr={[1, 2]} camera={{ fov: 38, position: [4, 3, 8] }} gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => { glRef.current = gl; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.85; }}>
          <color attach="background" args={['#10141b']} />
          <fog attach="fog" args={['#10141b', 30, 120]} />
          <Env />
          <hemisphereLight args={['#bcd0ff', '#2a2420', 0.35]} />
          <directionalLight position={[8, 12, 9]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.0004} />
          <SignModel structure={structure} maps={maps} wireframe={opts.wire} />
          {opts.human && <Human x={structure.board.widthM / 2 + 1.2} />}
          {opts.ground && (
            <>
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.002, 0]}><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#232a33" roughness={0.95} /></mesh>
              <gridHelper args={[60, 60, '#3a4556', '#2a323d']} position={[0, 0.001, 0]} />
            </>
          )}
          <Rig bbox={mesh.bbox} view={view} nonce={nonce} />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-auto flex gap-1 rounded-md border border-ink-600 bg-ink-900/85 p-1 backdrop-blur">
          <Btn id="persp">Perspective</Btn><Btn id="front">Front</Btn><Btn id="back">Back</Btn><Btn id="left">Left</Btn><Btn id="right">Right</Btn><Btn id="top">Top</Btn>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-ink-600 bg-ink-900/85 px-2 py-1 backdrop-blur">
          <Tog k="ground">Ground</Tog><Tog k="human">1.75 m figure</Tog><Tog k="wire">Wireframe</Tog>
          <button onClick={snapshot} className="rounded bg-ink-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-ink-600">Snapshot PNG</button>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-ink-600 bg-ink-900/85 px-2 py-1 text-[11px] text-slate-400 backdrop-blur">
        {structure.kind === 'flag' ? 'Flag' : 'Signboard'} {w}×{h} m · {mesh.vertexCount} verts · {mesh.triangleCount} tris · drag to orbit, scroll to zoom, right-drag to pan
      </div>
    </div>
  );
}

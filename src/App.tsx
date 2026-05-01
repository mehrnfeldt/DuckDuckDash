import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, Box, Text, Environment, Float, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Send, RotateCcw, HelpCircle, Trophy, AlertTriangle, ChevronRight, Zap, MapPin } from 'lucide-react';

// --- Types ---
type Command = {
  type: 'SWIM' | 'TURN_LEFT' | 'TURN_RIGHT' | 'REST';
  value?: number;
};

type HistoryEntry = {
  type: 'input' | 'output' | 'error';
  text: string;
};

// --- 3D Components ---
const OBSTACLES = [
  { x: 0, z: -20 },   // Center block
  { x: -6, z: -35 },  // Left block
  { x: 6, z: -50 },   // Right block
  { x: 0, z: -65 },   // Center block
  { x: -10, z: -75 }, // Left block
];

const SKYLINE_BUILDINGS = Array.from({ length: 20 }).map((_, i) => ({
  args: [5 + Math.random() * 8, 15 + Math.random() * 60, 5] as [number, number, number],
  position: [(i - 10) * 25, 0, 0] as [number, number, number],
  color: i % 2 === 0 ? "#0f172a" : "#1e293b"
}));

const RIVER_MARKERS = Array.from({ length: 100 }).map((_, i) => [0, -0.35, -i * 10] as [number, number, number]);

const CameraController = ({ target }: { target: THREE.Vector3 }) => {
  useFrame((state) => {
    // Offset for forward-facing perspective (behind and above)
    const offset = new THREE.Vector3(0, 5, 10);
    const cameraTarget = target.clone().add(offset);
    state.camera.position.lerp(cameraTarget, 0.08);
    state.camera.lookAt(target.x, target.y + 0.5, target.z - 2);
  });
  return null;
};

const Duck = ({ position, rotation, isSwimming }: { position: THREE.Vector3, rotation: number, isSwimming: boolean }) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Bobbing animation
      const t = state.clock.getElapsedTime();
      meshRef.current.position.y = position.y + Math.sin(t * 8) * (isSwimming ? 0.12 : 0.04);
      
      // Swimming waddle
      if (isSwimming) {
        meshRef.current.rotation.z = Math.sin(t * 15) * 0.15;
      } else {
        meshRef.current.rotation.z = 0;
      }
    }
  });

  return (
    <group ref={meshRef} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}>
      {/* Voxel Duck Body */}
      <RoundedBox args={[0.8, 0.7, 1]} radius={0.15} smoothness={4}>
        <meshStandardMaterial color="#fbbf24" roughness={0.6} />
      </RoundedBox>
      
      {/* Head */}
      <RoundedBox args={[0.6, 0.6, 0.6]} position={[0, 0.4, -0.2]} radius={0.1}>
        <meshStandardMaterial color="#fbbf24" roughness={0.6} />
      </RoundedBox>

      {/* Beak */}
      <RoundedBox args={[0.3, 0.15, 0.4]} position={[0, 0.35, -0.6]} radius={0.05}>
        <meshStandardMaterial color="#f97316" />
      </RoundedBox>

      {/* Eyes */}
      <Box args={[0.1, 0.1, 0.1]} position={[0.18, 0.5, -0.45]}>
        <meshStandardMaterial color="black" />
      </Box>
      <Box args={[0.1, 0.1, 0.1]} position={[-0.18, 0.5, -0.45]}>
        <meshStandardMaterial color="black" />
      </Box>

      {/* Little Wings */}
      <Box args={[0.1, 0.4, 0.6]} position={[0.45, 0, 0]}>
        <meshStandardMaterial color="#f59e0b" />
      </Box>
      <Box args={[0.1, 0.4, 0.6]} position={[-0.45, 0, 0]}>
        <meshStandardMaterial color="#f59e0b" />
      </Box>
    </group>
  );
};

const River = () => {
  return (
    <group>
      {/* Water Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, -500]}>
        <planeGeometry args={[30, 2000]} />
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.7} roughness={0} />
      </mesh>
      
      {/* Land Banks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-25, -0.38, -500]}>
        <planeGeometry args={[20, 2000]} />
        <meshStandardMaterial color="#14532d" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[25, -0.38, -500]}>
        <planeGeometry args={[20, 2000]} />
        <meshStandardMaterial color="#14532d" />
      </mesh>

      {/* River Bed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, -500]}>
        <planeGeometry args={[30, 2000]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>

      {/* Lanes / Markers */}
      {RIVER_MARKERS.map((pos, i) => (
        <Box key={i} args={[0.2, 0.05, 5]} position={pos}>
          <meshStandardMaterial color="white" transparent opacity={0.15} />
        </Box>
      ))}
    </group>
  );
};

const Obstacle = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position}>
      <RoundedBox args={[3, 0.6, 0.6]} radius={0.15}>
        <meshStandardMaterial color="#451a03" />
      </RoundedBox>
      {/* Floating leaves or bits */}
      <Box args={[0.3, 0.1, 0.3]} position={[1.2, 0.35, 0]}>
        <meshStandardMaterial color="#166534" />
      </Box>
      <Box args={[0.4, 0.1, 0.4]} position={[-1.2, 0.35, 0.2]}>
        <meshStandardMaterial color="#15803d" />
      </Box>
    </group>
  );
};

const Skyline = () => {
  return (
    <group position={[0, 0, -300]}>
      {SKYLINE_BUILDINGS.map((b, i) => (
        <Box key={i} args={b.args} position={b.position}>
          <meshStandardMaterial color={b.color} />
        </Box>
      ))}
    </group>
  );
};

const FinishLine = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position}>
      {/* Checkered pattern blocks */}
      {Array.from({ length: 15 }).map((_, i) => (
        <Box key={i} args={[2, 0.05, 1]} position={[(i - 7) * 2, 0, 0]}>
          <meshStandardMaterial color={i % 2 === 0 ? "white" : "black"} roughness={1} />
        </Box>
      ))}
      <pointLight position={[0, 2, 0]} intensity={10} color="#facc15" />
    </group>
  );
};

export default function App() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([
    { type: 'output', text: 'Duck Duck Dash' },
    { type: 'output', text: 'Initializing neural swim modules...' },
    { type: 'output', text: 'Ready. Use the handbook for syntax.' },
  ]);
  
  // Bot State
  const [botPos, setBotPos] = useState(new THREE.Vector3(0, 0, 0));
  const [botRot, setBotRot] = useState(0); // In radians
  const [isSwimming, setIsSwimming] = useState(false);
  const [stamina, setStamina] = useState(100);
  const staminaRef = useRef(100);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isCrossed, setIsCrossed] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  
  // System State
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [statusUI, setStatusUI] = useState<string | null>(null);
  const [forwardStepsAfterRight, setForwardStepsAfterRight] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const targetPos = useRef(new THREE.Vector3(0, 0, 0));
  const targetRot = useRef(0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Command Interpreter
  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim();

    if (trimmed === 'status()') {
       const heading = ((targetRot.current * 180 / Math.PI) % 360);
       const normalizedHeading = heading < 0 ? heading + 360 : heading;
       const statusStr = `X:${targetPos.current.x.toFixed(1)} Y:${Math.abs(targetPos.current.z).toFixed(1)} HEAD:${normalizedHeading.toFixed(0)}° NRG:${stamina}%`;
       setStatusUI(statusStr);
       setTimeout(() => setStatusUI(null), 3000);
       return 'Status data synchronized to HUD.';
    }

    if (trimmed === 'swim_forward()') {
      if (staminaRef.current <= 0) return 'Error: Power system offline. Use rest() to reboot.';
      
      // Constraint: 5 swim_forward() after turn_right()
      // We check if the last rotation set us in a "Right Turn" state
      // For simplicity, we track how many forwards happened since the last turn_right call
      if (forwardStepsAfterRight >= 5) {
        setScreenError('LATERAL LIMIT REACHED');
        setTimeout(() => setScreenError(null), 2000);
        return 'ConstraintError: Maximum lateral movement (5 steps) reached after right turn. Change course!';
      }

      const moveDist = 4; // Increased slightly for the larger scale
      const angle = targetRot.current;
      const nextX = targetPos.current.x - Math.sin(angle) * moveDist;
      const nextZ = targetPos.current.z - Math.cos(angle) * moveDist;

      // Boundary Check (River width is 30, so X is -15 to 15)
      if (Math.abs(nextX) > 15) {
        setScreenError('BOUNDARY REACHED');
        setTimeout(() => setScreenError(null), 2000);
        return 'BoundaryError: Cannot swim onto the riverbank! Correct your course.';
      }

      // Collision Check
      const hit = OBSTACLES.some(obs => {
        const dx = obs.x - nextX;
        const dz = obs.z - nextZ;
        return Math.sqrt(dx*dx + dz*dz) < 2.5; // Larger hit radius for larger scale
      });

      if (hit) {
        const newStamina = Math.max(0, staminaRef.current - 25);
        staminaRef.current = newStamina;
        setStamina(newStamina);
        setIsSwimming(true);
        await new Promise(r => setTimeout(r, 200));
        setIsSwimming(false);
        setScreenError('COLLISION: LOG BLOCKED');
        setTimeout(() => setScreenError(null), 2500);
        return 'CollisionError: Cannot swim over logs! Course blocked by debris.';
      }

      setIsSwimming(true);
      const nextStamina = Math.max(0, staminaRef.current - 8); 
      staminaRef.current = nextStamina;
      setStamina(nextStamina);
      
      targetPos.current.x = nextX;
      targetPos.current.z = nextZ;
      
      await new Promise(r => setTimeout(r, 600));
      setBotPos(new THREE.Vector3().copy(targetPos.current));
      setIsSwimming(false);
      
      // Increment lateral counter if we are facing "right" (which is -PI/2 in our CCW system)
      const isFacingRight = Math.abs((targetRot.current % (Math.PI * 2)) - (-Math.PI/2)) < 0.1 || 
                           Math.abs((targetRot.current % (Math.PI * 2)) - (Math.PI * 1.5)) < 0.1;

      if (isFacingRight) {
         setForwardStepsAfterRight(prev => prev + 1);
      } else {
         setForwardStepsAfterRight(0);
      }
      
      const totalDist = 80; // 20 commands (4 units each)
      const currentProg = Math.min(100, (Math.abs(targetPos.current.z) / totalDist) * 100);
      setProgress(currentProg);
      if (currentProg >= 100) setIsCrossed(true);
      
      return 'OK: Progressing...';
    }

    if (trimmed === 'turn_left()') {
      targetRot.current += Math.PI / 2;
      setBotRot(targetRot.current);
      setForwardStepsAfterRight(0); // Reset constraint
      await new Promise(r => setTimeout(r, 400));
      return 'OK: Rotated Left. Constraint reset.';
    }

    if (trimmed === 'turn_right()') {
      targetRot.current -= Math.PI / 2;
      setBotRot(targetRot.current);
      setForwardStepsAfterRight(0); // Start counter on right turn
      await new Promise(r => setTimeout(r, 400));
      return 'OK: Rotated Right. Lateral limit active: 5 steps max.';
    }

    if (trimmed === 'rest()') {
      const restored = Math.min(100, staminaRef.current + 30);
      staminaRef.current = restored;
      setStamina(restored);
      await new Promise(r => setTimeout(r, 800));
      return 'OK: Recharging energy...';
    }

    // Helpful Suggestions for typos
    const suggestions: {[key: string]: string} = {
      'swim': 'Did you mean swim_forward()?',
      'forward': 'Did you mean swim_forward()?',
      'left': 'Did you mean turn_left()?',
      'right': 'Did you mean turn_right()?',
      'turn': 'Did you mean turn_left() or turn_right()?',
      'rest': 'Missing parentheses? Use rest()',
      'recover': 'Did you mean rest()?',
      'sleep': 'Did you mean rest()?',
      'status': 'Did you mean status()?',
      'pos': 'Did you mean status()?',
      'swim_forward': 'Missing parentheses! Use: swim_forward()',
      'turn_left': 'Missing parentheses! Use: turn_left()',
      'turn_right': 'Missing parentheses! Use: turn_right()',
      'status_cmd': 'Missing parentheses! Use: status()',
    };

    const lower = trimmed.toLowerCase();
    for (const key in suggestions) {
      if (lower.includes(key)) {
        throw new Error(`SyntaxError: ${suggestions[key]}`);
      }
    }

    throw new Error(`NameError: name '${trimmed}' is not defined. Check the Handbook!`);
  };

  const handleInput = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing || isCrossed || isGameOver) return;

    setIsProcessing(true);
    setHistory(prev => [...prev, { type: 'input', text: input }]);

    try {
      // Support swim_forward(x)
      const swimMultiMatch = input.match(/^swim_forward\((\d+)\)$/);
      
      if (swimMultiMatch) {
        const count = parseInt(swimMultiMatch[1]);
        if (count > 10) {
          setHistory(prev => [...prev, { type: 'error', text: 'RuntimeError: Max step limit (10) exceeded.' }]);
        } else {
          for (let i = 0; i < count; i++) {
            if (staminaRef.current <= 0) {
              setHistory(prev => [...prev, { type: 'error', text: 'Movement halted: System reached critical power level 0%.' }]);
              break;
            }
            const res = await executeCommand('swim_forward()');
            setHistory(prev => [...prev, { type: 'output', text: `[Step ${i+1}/${count}] ${res}` }]);
            // Small delay between executions
            await new Promise(r => setTimeout(r, 150));
          }
        }
      } else {
        const res = await executeCommand(input);
        setHistory(prev => [...prev, { type: 'output', text: res }]);
      }
    } catch (err: any) {
      setHistory(prev => [...prev, { type: 'error', text: err.message }]);
    }

    setIsProcessing(false);
    setInput('');
  };

  const resetGame = () => {
    setBotPos(new THREE.Vector3(0, 0, 0));
    setBotRot(0);
    targetPos.current.set(0, 0, 0);
    targetRot.current = 0;
    staminaRef.current = 100;
    setStamina(100);
    setProgress(0);
    setForwardStepsAfterRight(0);
    setIsCrossed(false);
    setIsGameOver(false);
    setHistory([
      { type: 'output', text: 'Duck Duck Dash Re-initialized.' },
      { type: 'output', text: 'Mission: Help the duck cross the Schuylkill.' },
    ]);
  };

  useEffect(() => {
    if (stamina <= 0 && !isGameOver && !isCrossed) {
      setIsGameOver(true);
      setScreenError('ENERGY CRITICAL');
    }
  }, [stamina, isGameOver, isCrossed]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 font-sans overflow-hidden">
      {/* HUD Header */}
      <header className="bg-white border-b-4 border-blue-600 p-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-yellow-400 rounded-lg flex items-center justify-center border-b-4 border-yellow-600 text-2xl">🦆</div>
          <div>
            <h1 className="text-xl font-black text-yellow-600 leading-tight uppercase tracking-tight">Duck Duck Dash</h1>
            <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">River Runner Engine</p>
          </div>
        </div>
        
        <div className="flex gap-6 items-center">
          {/* Stamina Bar */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={12} className="text-yellow-500 fill-yellow-500" />
              <p className="text-[10px] uppercase font-black text-slate-400">Stamina</p>
            </div>
            <div className="w-32 h-3 bg-slate-200 rounded-full overflow-hidden border-2 border-slate-300">
               <motion.div 
                 className={`h-full ${stamina < 30 ? 'bg-red-500' : 'bg-yellow-400'}`}
                 animate={{ width: `${stamina}%` }}
               />
            </div>
          </div>

          {/* Progress */}
          <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 min-w-[100px]">
             <div className="flex items-center justify-center gap-1 mb-1">
               <MapPin size={10} className="text-blue-500" />
               <p className="text-[9px] uppercase font-bold text-blue-400 leading-none">Goal dist</p>
             </div>
             <div className="text-lg font-black text-blue-800 text-center">{Math.floor(progress)}%</div>
          </div>

          <button onClick={resetGame} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
            <RotateCcw size={20} />
          </button>
        </div>
      </header>

      {/* 3D Scene Viewport */}
      {/* BOT_ID: 0xCROSSY */}
      
      {/* Bot Movement Scale: 20 steps to reach goal */}
      {/* totalDist = 80, moveDist = 4 */}
      
      {/* Constraints */}
      {forwardStepsAfterRight >= 5 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-2 rounded-full text-xs font-bold z-50 animate-bounce">
          LATERAL STEP LIMIT REACHED: TURN LEFT TO RESET
        </div>
      )}

      {/* Collision/Error Overlay */}
      <AnimatePresence>
        {screenError && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -20 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-4 pointer-events-none"
          >
            <div className="bg-rose-600 text-white px-8 py-4 rounded-2xl border-4 border-rose-400 flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg animate-pulse">
                <Terminal size={24} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">System Alert</p>
                <p className="text-lg font-black uppercase tracking-tight">{screenError}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status HUD Popup */}
      <AnimatePresence>
        {statusUI && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-emerald-600 text-white px-6 py-3 rounded-full border-2 border-emerald-400 flex items-center gap-3">
              <div className="bg-white/20 p-1.5 rounded-full">
                <MapPin size={16} className="text-white" />
              </div>
              <span className="font-mono font-black text-sm tracking-tighter">{statusUI}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 relative bg-sky-200 overflow-hidden">
        {/* HUD - Bottom Left */}
        <div className="absolute bottom-6 left-6 z-40 flex flex-col gap-2 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border-2 border-slate-700/50 flex flex-col gap-3 min-w-[180px]">
             <div className="flex items-center justify-between border-b border-slate-700 pb-2">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Navigation HUD</span>
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             </div>
             
             <div className="space-y-3">
               <div>
                 <div className="flex justify-between items-end mb-1">
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1"><Zap size={10} /> Energy</span>
                   <span className={`text-xs font-black ${stamina < 30 ? 'text-rose-400' : 'text-yellow-400'}`}>{stamina}%</span>
                 </div>
                 <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                   <motion.div 
                     className={`h-full ${stamina < 30 ? 'bg-rose-500' : 'bg-yellow-400'}`}
                     animate={{ width: `${stamina}%` }}
                   />
                 </div>
               </div>

               <div className="flex gap-4">
                 <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">X-POS</p>
                   <p className="text-sm font-mono font-black text-white">{targetPos.current.x.toFixed(1)}</p>
                 </div>
                 <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Z-POS</p>
                   <p className="text-sm font-mono font-black text-white">{Math.abs(targetPos.current.z).toFixed(1)}</p>
                 </div>
                 <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">HEAD</p>
                   <p className="text-sm font-mono font-black text-white">{((targetRot.current * 180 / Math.PI) % 360).toFixed(0)}°</p>
                 </div>
               </div>
             </div>
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/50 flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${forwardStepsAfterRight >= 5 ? 'bg-rose-500' : 'bg-slate-600'}`} />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step Lock: {forwardStepsAfterRight}/5</span>
          </div>
        </div>

        <Canvas shadows dpr={[1, 2]}>
          {/* ... existing scene children ... */}
          <CameraController target={botPos} />

          <ambientLight intensity={1.5} />
          <directionalLight 
            position={[10, 20, 10]} 
            intensity={2} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
          />
          
          <River />
          <Skyline />
          <FinishLine position={[0, -0.38, -80]} />
          
          {OBSTACLES.map((obs, i) => (
            <Obstacle key={i} position={[obs.x, -0.2, obs.z]} />
          ))}

          <Duck position={botPos} rotation={botRot} isSwimming={isSwimming} />
          
          <Environment preset="city" />
          <fog attach="fog" args={['#bae6fd', 30, 400]} />
        </Canvas>

        {/* Floating Command Button */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-40">
           <button 
             onClick={() => setShowCommands(!showCommands)}
             className="bg-white border-b-4 border-yellow-500 p-3 rounded-xl text-yellow-700 hover:bg-yellow-50 transition-all flex items-center gap-2 font-black uppercase text-xs tracking-tight"
           >
             <HelpCircle size={18} /> {showCommands ? 'Close Handbook' : 'Open Handbook'}
           </button>

           <AnimatePresence>
             {showCommands && (
               <motion.div 
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 className="bg-white p-5 rounded-2xl border-4 border-yellow-500 w-64 max-h-[40vh] overflow-y-auto space-y-4 scrollbar-hide"
               >
                 <h2 className="text-sm font-black text-yellow-600 uppercase tracking-widest border-b-2 border-yellow-200 pb-2">Duck Duck Dash</h2>
                 <div className="space-y-2 text-xs font-bold text-slate-600">
                    <p className="bg-slate-100 p-2 rounded-lg font-mono text-blue-600">swim_forward()</p>
                    <p className="bg-slate-100 p-2 rounded-lg font-mono text-blue-600">swim_forward(x)</p>
                    <p className="bg-slate-100 p-2 rounded-lg font-mono text-blue-600">turn_right()</p>
                    <p className="bg-slate-100 p-2 rounded-lg font-mono text-blue-600">turn_left()</p>
                    <p className="bg-slate-100 p-2 rounded-lg font-mono text-blue-600">rest()</p>
                    <p className="bg-slate-100 p-2 rounded-lg font-mono text-blue-600">status()</p>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        {/* Console Overlay for Win */}
        <AnimatePresence>
          {isCrossed && (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               className="absolute inset-0 z-40 bg-blue-900/60 backdrop-blur-md flex items-center justify-center"
            >
               <div className="bg-white p-10 rounded-[3rem] border-8 border-yellow-400 text-center max-w-sm">
                  <Trophy size={60} className="mx-auto text-yellow-500 mb-4" />
                  <h2 className="text-4xl font-black text-blue-900 uppercase italic mb-2">Crossed!</h2>
                  <p className="text-slate-600 font-bold mb-6 italic">Py-Bot is now a Philadelphia local.</p>
                  <button onClick={resetGame} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl">REPLAY</button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Console Overlay for Game Over */}
        <AnimatePresence>
          {isGameOver && (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }}
               className="absolute inset-0 z-40 bg-rose-950/80 backdrop-blur-md flex items-center justify-center"
            >
               <div className="bg-white p-10 rounded-[3rem] border-8 border-rose-600 text-center max-w-sm">
                  <AlertTriangle size={60} className="mx-auto text-rose-500 mb-4" />
                  <h2 className="text-4xl font-black text-rose-900 uppercase italic mb-2">Game Over</h2>
                  <p className="text-slate-600 font-bold mb-6 italic">The duck is too tired to continue. Stamina depleted.</p>
                  <button onClick={resetGame} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl">TRY AGAIN</button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Terminal Footer */}
      <footer className="h-24 bg-slate-900 flex flex-col p-2 gap-1 border-t-8 border-slate-800 z-20">
        <div className="flex items-center justify-between text-slate-400 font-mono text-[7px] uppercase tracking-widest px-1">
          <span className="flex items-center gap-1 font-bold">
            <Terminal size={10} className="text-yellow-500" /> QUACK-REPL-3D // STATUS: {isProcessing ? 'SWIMMING' : 'READY'}
          </span>
        </div>

        <div className="flex-1 bg-black rounded-lg border-2 border-slate-800 p-2 font-mono overflow-hidden flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 mb-1 scrollbar-hide text-[9px]">
             {history.map((entry, i) => (
                <div key={i} className={`flex gap-2 ${entry.type === 'error' ? 'text-rose-400 bg-rose-500/10 p-0.5 rounded' : entry.type === 'input' ? 'text-slate-400' : 'text-blue-400 italic'}`}>
                  <span className="font-bold opacity-30 select-none shrink-0">{entry.type === 'input' ? '>>>' : '::'}</span>
                  <span className="break-all whitespace-pre-wrap">{entry.text}</span>
                </div>
             ))}
          </div>
          
          <form onSubmit={handleInput} className={`flex items-center gap-3 p-2 rounded-lg ring-2 transition-all ${isProcessing ? 'opacity-50 ring-slate-800' : 'bg-blue-500/10 ring-blue-500'}`}>
             <span className="text-blue-400 font-black text-sm select-none">&gt;&gt;&gt;</span>
             <input 
               autoFocus
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               placeholder={isProcessing ? "Processing..." : isGameOver ? "GAME OVER" : "Commands..."}
               disabled={isProcessing || isCrossed || isGameOver}
               className="bg-transparent text-white text-sm outline-none w-full border-none font-bold placeholder:text-slate-700/50"
             />
             <button type="submit" disabled={!input.trim() || isProcessing || isCrossed || isGameOver} className="px-4 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-black rounded-md text-[10px] uppercase tracking-widest transition-all">
                Run
             </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

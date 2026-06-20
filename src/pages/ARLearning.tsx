import { useState, useEffect, useRef } from 'react';
import { getARLessons, type ARLesson, type ARStep } from '../lib/arService';
import { 
  ArrowLeft, 
  RotateCcw, 
  HelpCircle, 
  Camera, 
  VideoOff, 
  Sparkles,
  Trophy,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface ARLearningProps {
  onBack?: () => void;
}

export default function ARLearning({ onBack }: ARLearningProps) {
  const [levels, setLevels] = useState<ARLesson[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  
  // Webcam & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiLoadingRef = useRef<HTMLDivElement | null>(null);
  const cameraInstanceRef = useRef<any>(null);

  // States
  const [handDetected, setHandDetected] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');

  // Game physical references
  const cardsRef = useRef<any[]>([]);
  const slotsRef = useRef<any[]>([]);
  const activeHandRef = useRef({ x: 0, y: 0, isPinching: false, rawX: 0, rawY: 0 });
  const draggedCardRef = useRef<any>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const hoverTargetRef = useRef<any>(null);
  const cursorColorRef = useRef("rgb(6, 182, 212)");
  const cursorSymbolRef = useRef("");
  
  // Animation frames
  const requestRef = useRef<number | null>(null);
  const levelRef = useRef<number>(0);
  levelRef.current = currentLevelIndex;
  
  const levelsRef = useRef<ARLesson[]>([]);
  levelsRef.current = levels;

  useEffect(() => {
    // 1. Fetch Lessons Data
    async function loadLevels() {
      setLoading(true);
      try {
        const data = await getARLessons();
        setLevels(data);
      } catch (e) {
        console.error('Failed to load levels:', e);
      } finally {
        setLoading(false);
      }
    }
    loadLevels();

    return () => {
      stopCameraAndLoop();
    };
  }, []);

  // Initialize card positions for the current level
  useEffect(() => {
    if (levels.length === 0 || currentLevelIndex >= levels.length || !canvasRef.current) return;
    initLevelLayout(currentLevelIndex);
  }, [levels, currentLevelIndex, gameStarted]);

  function stopCameraAndLoop() {
    // Stop Animation Loop
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    // Stop Camera
    if (cameraInstanceRef.current) {
      try {
        cameraInstanceRef.current.stop();
      } catch (e) {}
      cameraInstanceRef.current = null;
    }
    // Stop Video Track directly
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  }

  function initLevelLayout(targetIndex?: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const idx = targetIndex !== undefined ? targetIndex : currentLevelIndex;
    if (levels.length === 0 || idx >= levels.length) return;
    
    const level = levels[idx];
    const width = canvas.width;
    const height = canvas.height;
    
    // 1. Setup Slots (Target placement zone at the bottom)
    const slotsCount = level.steps.length;
    const slotWidth = Math.min(width * (0.8 / slotsCount), 170);
    const slotHeight = Math.min(height * 0.22, 130);
    const spacing = 16;
    const totalWidth = (slotWidth * slotsCount) + (spacing * (slotsCount - 1));
    const startX = (width - totalWidth) / 2;
    const slotY = height - slotHeight - 40;

    slotsRef.current = [];
    for (let i = 0; i < slotsCount; i++) {
      slotsRef.current.push({
        index: i + 1,
        x: startX + (i * (slotWidth + spacing)),
        y: slotY,
        width: slotWidth,
        height: slotHeight,
        filledCard: null
      });
    }

    // 2. Setup Cards (Floating elements at the top, shuffled)
    const cardWidth = slotWidth;
    const cardHeight = slotHeight;
    const shuffledSteps = [...level.steps].sort(() => Math.random() - 0.5);
    
    const poolY = 80;
    const stepX = (width - ((cardWidth * slotsCount) + (spacing * (slotsCount - 1)))) / 2;
    
    cardsRef.current = shuffledSteps.map((step, idx) => ({
      id: step.id,
      text: step.step_text,
      emoji: step.emoji,
      correctOrder: level.steps.findIndex(s => s.id === step.id) + 1,
      width: cardWidth,
      height: cardHeight,
      x: stepX + (idx * (cardWidth + spacing)),
      y: poolY,
      originX: stepX + (idx * (cardWidth + spacing)),
      originY: poolY,
      isDragging: false,
      placedInSlot: null
    }));
  }

  // --- Dynamic Loader for MediaPipe ---
  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  async function startARSystem() {
    setCameraStatus('loading');
    if (aiLoadingRef.current) aiLoadingRef.current.style.display = 'flex';
    
    try {
      // 0. ตรวจสอบความพร้อมใช้งานของกล้องก่อนรันโมเดล เพื่อป้องกัน Popup Error เมื่อไม่มีอุปกรณ์
      let hasWebcam = false;
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasWebcam = devices.some(device => device.kind === 'videoinput');
        }
      } catch (e) {
        console.warn('Cannot query media devices, assuming no camera:', e);
      }

      if (!hasWebcam) {
        throw new Error('ไม่พบอุปกรณ์กล้องเว็บแคมเชื่อมต่อกับคอมพิวเตอร์ของคุณ');
      }

      // 1. Load MediaPipe JS files dynamically
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      
      const win = window as any;
      if (!win.Hands || !win.Camera) {
        throw new Error('MediaPipe libraries did not initialize correctly.');
      }

      // 2. Setup MediaPipe Hands model
      const handsObj = new win.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      handsObj.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      handsObj.onResults(onHandResults);

      // 3. Start Camera
      if (videoRef.current) {
        cameraInstanceRef.current = new win.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await handsObj.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        await cameraInstanceRef.current.start();
        setCameraStatus('active');
        
        // Hide loading screen
        if (aiLoadingRef.current) {
          aiLoadingRef.current.style.opacity = '0';
          setTimeout(() => {
            if (aiLoadingRef.current) aiLoadingRef.current.style.display = 'none';
          }, 500);
        }
      }
    } catch (err: any) {
      console.error('Failed to initialize AR system:', err);
      setCameraStatus('error');
      setCameraErrorMsg(err.message || 'ไม่สามารถเปิดกล้องได้');
      if (aiLoadingRef.current) {
        aiLoadingRef.current.style.display = 'none';
      }
    }

    // Start Rendering Loop
    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(drawLoop);
    }
  }

  // --- Hand tracking results from MediaPipe ---
  function onHandResults(results: any) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setHandDetected(true);
      const landmarks = results.multiHandLandmarks[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Coordinate matching (Mirrored horizontally)
      const rawX = landmarks[8].x;
      const rawY = landmarks[8].y;
      
      activeHandRef.current.x = (1 - rawX) * canvas.width;
      activeHandRef.current.y = rawY * canvas.height;
      activeHandRef.current.rawX = landmarks[8].x;
      activeHandRef.current.rawY = landmarks[8].y;

      // Math.sqrt(dx*dx + dy*dy) for Pinch detection (Thumb tip 4 vs Index finger tip 8)
      const thumb = landmarks[4];
      const indexTip = landmarks[8];
      const dx = thumb.x - indexTip.x;
      const dy = thumb.y - indexTip.y;
      const distance = Math.sqrt(dx*dx + dy*dy);

      const pinchThreshold = 0.055;
      const isPinchingNow = distance < pinchThreshold;
      
      if (isPinchingNow && !activeHandRef.current.isPinching) {
        activeHandRef.current.isPinching = true;
        startPinch(activeHandRef.current.x, activeHandRef.current.y);
      } else if (!isPinchingNow && activeHandRef.current.isPinching) {
        activeHandRef.current.isPinching = false;
        releasePinch();
      }

      if (activeHandRef.current.isPinching && draggedCardRef.current) {
        draggedCardRef.current.x = activeHandRef.current.x - dragOffsetRef.current.x;
        draggedCardRef.current.y = activeHandRef.current.y - dragOffsetRef.current.y;
      }
    } else {
      setHandDetected(false);
      if (activeHandRef.current.isPinching) {
        activeHandRef.current.isPinching = false;
        releasePinch();
      }
    }
  }

  // --- Physics Pinch Actions ---
  function startPinch(x: number, y: number) {
    let hit = false;
    const cards = cardsRef.current;
    
    for (let i = cards.length - 1; i >= 0; i--) {
      const card = cards[i];
      if (x >= card.x && x <= card.x + card.width &&
          y >= card.y && y <= card.y + card.height) {
        draggedCardRef.current = card;
        card.isDragging = true;
        dragOffsetRef.current.x = x - card.x;
        dragOffsetRef.current.y = y - card.y;
        
        if (card.placedInSlot) {
          card.placedInSlot.filledCard = null;
          card.placedInSlot = null;
        }
        hit = true;
        cursorColorRef.current = "rgb(34, 197, 94)"; // green
        cursorSymbolRef.current = "✔️";
        break;
      }
    }
    
    if (!hit) {
      cursorColorRef.current = "rgb(239, 68, 68)"; // red
      cursorSymbolRef.current = "❌";
      setTimeout(() => {
        if (!draggedCardRef.current && !activeHandRef.current.isPinching) {
          cursorSymbolRef.current = "";
        }
      }, 600);
    }
  }

  function releasePinch() {
    if (draggedCardRef.current) {
      draggedCardRef.current.isDragging = false;
      let placed = false;
      const card = draggedCardRef.current;
      const centerX = card.x + card.width / 2;
      const centerY = card.y + card.height / 2;

      for (let slot of slotsRef.current) {
        if (!slot.filledCard) {
          const slotCenterX = slot.x + slot.width / 2;
          const slotCenterY = slot.y + slot.height / 2;
          const distance = Math.sqrt(Math.pow(centerX - slotCenterX, 2) + Math.pow(centerY - slotCenterY, 2));
          
          if (distance < 90) {
            card.x = slot.x;
            card.y = slot.y;
            card.placedInSlot = slot;
            slot.filledCard = card;
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        card.x = card.originX;
        card.y = card.originY;
      }

      draggedCardRef.current = null;
      cursorSymbolRef.current = "";
      checkVictoryCondition();
    }
  }

  function checkVictoryCondition() {
    const slots = slotsRef.current;
    const allFilled = slots.every(slot => slot.filledCard !== null);
    if (!allFilled) return;

    const isCorrect = slots.every(slot => slot.filledCard.correctOrder === slot.index);
    
    if (isCorrect) {
      setScore(prev => prev + 100);
      
      // Level Cleared Green Flash Effect logic handled inside drawLoop
      // Wait a bit and transition to next level
      setTimeout(() => {
        const nextIdx = levelRef.current + 1;
        if (nextIdx < levels.length) {
          setCurrentLevelIndex(nextIdx);
        } else {
          // Finished the game!
          setGameFinished(true);
          stopCameraAndLoop();
        }
      }, 1200);
    } else {
      // Incorrect layout: Shake and return wrong cards
      setTimeout(() => {
        slots.forEach(slot => {
          if (slot.filledCard && slot.filledCard.correctOrder !== slot.index) {
            const card = slot.filledCard;
            card.x = card.originX;
            card.y = card.originY;
            card.placedInSlot = null;
            slot.filledCard = null;
          }
        });
      }, 800);
    }
  }

  // --- Rendering loop ---
  function drawLoop() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const video = videoRef.current;
    
    if (!canvas || !ctx) {
      requestRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    // Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Mirror Video Image on background
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const cWidth = canvas.width;
      const cHeight = canvas.height;
      const vRatio = vWidth / vHeight;
      const cRatio = cWidth / cHeight;
      
      let sx, sy, sWidth, sHeight;
      if (cRatio > vRatio) {
        sWidth = vWidth;
        sHeight = vWidth / cRatio;
        sx = 0;
        sy = (vHeight - sHeight) / 2;
      } else {
        sHeight = vHeight;
        sWidth = vHeight * cRatio;
        sx = (vWidth - sWidth) / 2;
        sy = 0;
      }
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, cWidth, cHeight);
    } else {
      // Default Gradient if camera offline
      const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, canvas.width);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    // 2. Draw Target Slots
    slotsRef.current.forEach(slot => {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.5)";
      ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      ctx.roundRect(slot.x, slot.y, slot.width, slot.height, 20);
      ctx.fill();
      ctx.stroke();

      // Dotted inner outline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.roundRect(slot.x + 8, slot.y + 8, slot.width - 16, slot.height - 16, 14);
      ctx.stroke();
      ctx.restore();

      // Slot Order Label / Translation Matcher
      const level = levelsRef.current[levelRef.current];
      const matchingStep = level?.steps[slot.index - 1];
      const hasTranslation = matchingStep ? (matchingStep.step_text.includes(':') || matchingStep.step_text.includes('：')) : false;
      const separator = matchingStep?.step_text.includes('：') ? '：' : ':';
      const slotLabel = hasTranslation ? matchingStep!.step_text.split(separator)[1].trim() : 'ขั้นตอนที่';

      if (hasTranslation) {
        // Render slot with target translation text in the center
        ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
        ctx.beginPath();
        ctx.roundRect(slot.x + 8, slot.y + slot.height/2 - 20, slot.width - 16, 40, 10);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = "bold 14px Sarabun";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(slotLabel, slot.x + slot.width/2, slot.y + slot.height/2);
      } else {
        // Render original step order badge style
        ctx.fillStyle = "rgba(6, 182, 212, 0.85)";
        ctx.beginPath();
        ctx.arc(slot.x + slot.width/2, slot.y + slot.height - 22, 16, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px Sarabun";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(slot.index), slot.x + slot.width/2, slot.y + slot.height - 22);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.font = "bold 11px Sarabun";
        ctx.fillText("ขั้นตอนที่", slot.x + slot.width/2, slot.y + 25);
      }
    });

    // 3. Draw Cards
    // Check hover states
    hoverTargetRef.current = null;
    const hx = activeHandRef.current.x;
    const hy = activeHandRef.current.y;
    cardsRef.current.forEach(card => {
      if (hx >= card.x && hx <= card.x + card.width &&
          hy >= card.y && hy <= card.y + card.height) {
        hoverTargetRef.current = card;
      }
    });

    cardsRef.current.forEach(card => {
      ctx.save();
      
      // Shadow
      const shadowOffset = card.isDragging ? 8 : 4;
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.beginPath();
      ctx.roundRect(card.x + shadowOffset, card.y + shadowOffset, card.width, card.height, 20);
      ctx.fill();

      // Card body (Increase opacity to prevent webcam background from washing out Emojis)
      if (card.isDragging) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
        ctx.strokeStyle = "rgba(6, 182, 212, 1)";
        ctx.lineWidth = 3.5;
      } else if (hoverTargetRef.current === card) {
        ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
        ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)"; // Darker slate to make content highly visible
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
      }

      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.width, card.height, 20);
      ctx.fill();
      ctx.stroke();

      // Emoji (Scaled up for clarity)
      ctx.font = "50px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(card.emoji, card.x + card.width / 2, card.y + card.height / 2 - 15);

      // Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px Sarabun";
      ctx.textAlign = "center";
      
      const hasCardTranslation = card.text.includes(':') || card.text.includes('：');
      const cardSeparator = card.text.includes('：') ? '：' : ':';
      const cardText = hasCardTranslation ? card.text.split(cardSeparator)[0].trim() : card.text;
      if (cardText.length > 14) {
        ctx.fillText(cardText.slice(0, 13) + "...", card.x + card.width / 2, card.y + card.height - 25);
      } else {
        ctx.fillText(cardText, card.x + card.width / 2, card.y + card.height - 25);
      }

      ctx.restore();
    });

    // 4. Draw AR Cursor Feedback
    const isPinching = activeHandRef.current.isPinching;
    const cursorSymbol = cursorSymbolRef.current;
    
    // Draw cursor if hand detected or mouse is active
    if (handDetected || isMouseDown || hoverTargetRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, 18, 0, Math.PI * 2);
      
      if (isPinching) {
        ctx.strokeStyle = cursorColorRef.current;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (hoverTargetRef.current) {
        ctx.strokeStyle = "rgb(245, 158, 11)"; 
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgb(6, 182, 212)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = isPinching ? cursorColorRef.current : "rgb(6, 182, 212)";
      ctx.fill();

      if (cursorSymbol) {
        ctx.font = "bold 15px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(cursorSymbol, hx + 22, hy - 22);
      }
      ctx.restore();
    }

    // Check level complete green-flash overlay
    const allFilled = slotsRef.current.every(s => s.filledCard !== null);
    if (allFilled) {
      const isCorrect = slotsRef.current.every(s => s.filledCard.correctOrder === s.index);
      if (isCorrect) {
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestRef.current = requestAnimationFrame(drawLoop);
  }

  // --- Mouse / Touch Fallback Controls ---
  const [isMouseDown, setIsMouseDown] = useState(false);

  function getMouseCoords(e: any) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function handleMouseDown(e: any) {
    if (handDetected) return; // Prioritize AI hand tracking
    setIsMouseDown(true);
    const coords = getMouseCoords(e);
    activeHandRef.current.x = coords.x;
    activeHandRef.current.y = coords.y;
    activeHandRef.current.isPinching = true;
    startPinch(coords.x, coords.y);
  }

  function handleMouseMove(e: any) {
    const coords = getMouseCoords(e);
    if (!handDetected) {
      activeHandRef.current.x = coords.x;
      activeHandRef.current.y = coords.y;
    }
    
    if (isMouseDown && draggedCardRef.current && !handDetected) {
      draggedCardRef.current.x = coords.x - dragOffsetRef.current.x;
      draggedCardRef.current.y = coords.y - dragOffsetRef.current.y;
    }
  }

  function handleMouseUp() {
    if (isMouseDown && !handDetected) {
      setIsMouseDown(false);
      activeHandRef.current.isPinching = false;
      releasePinch();
    }
  }

  // Handle Game Start
  function handleStartGame(index?: number) {
    const targetIdx = index !== undefined ? index : currentLevelIndex;
    if (index !== undefined) {
      setCurrentLevelIndex(index);
    }
    setGameStarted(true);
    // Give canvas a frame to render before measuring
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = canvas.parentElement?.clientWidth || 640;
        canvas.height = canvas.parentElement?.clientHeight || 450;
        initLevelLayout(targetIdx);
      }
      startARSystem();
    }, 100);
  }

  // Restart Game
  function handleRestart() {
    setGameFinished(false);
    setCurrentLevelIndex(0);
    setScore(0);
    setTimeout(() => {
      handleStartGame(0);
    }, 100);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col justify-between select-none relative">
      <video id="webcam" ref={videoRef} className="hidden" autoPlay playsInline></video>

      {/* Game Header */}
      <header className="relative z-10 w-full flex justify-between items-center bg-slate-900/40 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              stopCameraAndLoop();
              if (onBack) onBack();
            }}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-wide text-cyan-400">น้องชบาพาพิชิต (AR)</h1>
            <p className="text-[10px] text-slate-400">เกมส์เรียงลำดับแก้ปัญหาด้วยตรรกะอัลกอริทึม</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-slate-950/60 rounded-xl border border-cyan-500/25 text-center">
            <span className="text-[9px] block text-slate-500 uppercase font-bold">LEVEL</span>
            <span className="text-sm font-black text-cyan-300">
              {levels.length > 0 ? `${currentLevelIndex + 1} / ${levels.length}` : '-'}
            </span>
          </div>
          <div className="px-3.5 py-1.5 bg-slate-950/60 rounded-xl border border-amber-500/25 text-center">
            <span className="text-[9px] block text-slate-500 uppercase font-bold">SCORE</span>
            <span className="text-sm font-black text-amber-400">{score}</span>
          </div>
        </div>
      </header>

      {/* Main Sandbox Workspace */}
      <main className="flex-grow my-3 flex flex-col lg:flex-row gap-4 items-stretch relative overflow-hidden z-10">
        
        {/* Left sidebar info */}
        <div className="w-full lg:w-1/4 flex flex-col justify-between gap-4">
          
          {/* Mission Card */}
          <div className="bg-slate-900/40 backdrop-blur p-5 rounded-2xl flex-grow flex flex-col justify-center border-l-4 border-cyan-400 border border-white/10">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">ภารกิจของคุณ</span>
            <h2 className="text-lg md:text-xl font-extrabold text-white leading-relaxed">
              {levels.length > 0 ? levels[currentLevelIndex].title : 'กำลังโหลดภารกิจ...'}
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {levels.length > 0 ? levels[currentLevelIndex].description : 'ระบบกำลังดึงข้อมูลบทเรียน...'}
            </p>
          </div>

          {/* Controls status */}
          <div className="bg-slate-900/40 backdrop-blur p-5 rounded-2xl border border-white/10 flex flex-col gap-3">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">สถานะระบบการควบคุม</h3>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cameraStatus === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${cameraStatus === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                เว็บแคม & การตรวจนิ้วมือ
              </span>
              <span className={`font-bold ${cameraStatus === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {cameraStatus === 'active' ? 'พร้อมใช้งาน' : cameraStatus === 'loading' ? 'กำลังเชื่อม...' : 'ออฟไลน์ (เมาส์แทน)'}
              </span>
            </div>

            <div className="text-[10px] text-slate-500 border-t border-white/5 pt-2 leading-relaxed">
              💡 <strong>วิธีควบคุมกล้อง:</strong> หันมือเข้าหากล้อง กางนิ้วเล็งวงกลมไปที่การ์ด จากนั้น <strong>จีบปลายนิ้วชี้และนิ้วโป้งชนกันเพื่อหยิบ</strong> และกางนิ้วออกเพื่อปล่อยวางลงในช่อง
            </div>
          </div>

        </div>

        {/* Center: AR Canvas view */}
        <div className="flex-grow relative rounded-3xl overflow-hidden bg-slate-900/20 border border-white/10 flex items-center justify-center min-h-[400px]">
          
          <canvas 
            ref={canvasRef} 
            className="w-full h-full object-cover z-10"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          ></canvas>

          {/* AI Loader overlay */}
          <div 
            ref={aiLoadingRef}
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 z-20 transition-opacity duration-500"
          >
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-cyan-400 font-bold animate-pulse text-center px-4">
              กำลังเริ่มต้นระบบตรวจจับและเข้าถึงกล้องเว็บแคม...
            </p>
          </div>

          {/* Hand missing warning overlay */}
          {!handDetected && gameStarted && cameraStatus === 'active' && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/80 backdrop-blur text-slate-950 text-xs px-4 py-2 rounded-full font-bold z-30 shadow-lg animate-bounce flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              หามือไม่เจอ (แสดงมือของคุณหน้ากล้อง หรือใช้เมาส์คลิกลากการ์ดแทน)
            </div>
          )}

          {/* Welcome Screen */}
          {!gameStarted && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-40">
              {loading ? (
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
                  <p className="text-slate-400 text-xs">กำลังสแกนโครงสร้างบทเรียน...</p>
                </div>
              ) : (
                <div className="text-center p-6 max-w-lg bg-slate-900/60 backdrop-blur border border-white/10 rounded-3xl shadow-2xl mx-4 w-full md:w-[440px]">
                  <div className="text-5xl mb-3 animate-bounce">🤖🏆</div>
                  <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 mb-1">
                    น้องชบาพาพิชิต (AR)
                  </h2>
                  <p className="text-slate-400 text-[11px] mb-4 leading-relaxed font-semibold">
                    เลือกบทเรียนที่ต้องการเพื่อเริ่มต้นฝึกฝนลำดับขั้นตอนการแก้ปัญหาเชิงตรรกะ!
                  </p>
                  
                  {/* Stage Selection list */}
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1.5 text-left mb-2 custom-scrollbar">
                    {levels.map((level, idx) => (
                      <button
                        key={level.id}
                        onClick={() => handleStartGame(idx)}
                        className="w-full p-3.5 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-400/50 rounded-xl flex items-center justify-between transition cursor-pointer text-xs font-bold group"
                      >
                        <span className="truncate pr-2 text-slate-200 group-hover:text-cyan-300">🎮 {idx + 1}. {level.title}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full font-bold shrink-0">
                          {level.steps.length} ขั้นตอน
                        </span>
                      </button>
                    ))}
                  </div>

                  {levels.length === 0 && (
                    <p className="text-amber-400 text-xs py-3">⚠️ ยังไม่มีบทเรียนในระบบ กรุณาเข้าสู่ระบบคุณครูเพื่อสร้างบทเรียนก่อนนะคะ</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Finish Screen */}
          {gameFinished && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-40">
              <div className="text-center p-10 max-w-sm bg-slate-900/60 backdrop-blur border border-white/10 rounded-3xl shadow-2xl">
                <div className="text-7xl mb-4 animate-pulse">🏆🌟</div>
                <h2 className="text-3xl font-black text-emerald-400 mb-2">ALL CLEAR!</h2>
                <p className="text-slate-300 text-sm mb-5 leading-relaxed">คุณได้ฝึกคิดและแก้ไขปัญหาตามลำดับอัลกอริทึมครบทุกบทเรียนเรียบร้อยแล้ว</p>
                <div className="text-xl font-extrabold text-amber-400 mb-6">คะแนนรวมทั้งหมด: {score} คะแนน</div>
                <button 
                  onClick={handleRestart}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg transform hover:-translate-y-0.5 transition duration-300 cursor-pointer"
                >
                  เล่นใหม่อีกครั้ง 🔄
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer info */}
      <footer className="relative z-10 w-full flex justify-between items-center text-[10px] text-slate-600 bg-slate-900/20 backdrop-blur border border-white/5 px-4 py-2 rounded-xl">
        <div>ระบบ AI ค้นหานิ้วมือ MediaPipe Client-Side (ไม่ส่งภาพขึ้นคลาวด์)</div>
        <div>วิชาวิทยาการคำนวณ โรงเรียนประถมวิทยา</div>
      </footer>
    </div>
  );
}

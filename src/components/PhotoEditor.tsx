import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  RotateCcw, 
  Sun, 
  Contrast as ContrastIcon, 
  Droplets, 
  Ghost, 
  Palette, 
  Image as ImageIcon,
  Layers,
  Undo,
  Save,
  Trash2,
  Sparkles,
  Crop as CropIcon,
  RotateCw,
  Maximize,
  Check,
  X,
  Zap,
  Wind
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import Cropper, { Area, Point } from 'react-easy-crop';

interface FilterState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hueRotate: number;
  grayscale: number;
  sepia: number;
  invert: number;
  sharpen: number;
}

const initialFilters: FilterState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  hueRotate: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  sharpen: 0,
};

const presets = [
  { name: 'Original', filters: initialFilters },
  { name: 'B&W', filters: { ...initialFilters, grayscale: 100 } },
  { name: 'Vintage', filters: { ...initialFilters, sepia: 50, contrast: 120, brightness: 90 } },
  { name: 'Dramatic', filters: { ...initialFilters, contrast: 150, saturation: 120 } },
  { name: 'Neon Blue', filters: { ...initialFilters, hueRotate: 190, saturation: 180, contrast: 130 } },
  { name: 'Neon Pink', filters: { ...initialFilters, hueRotate: 300, saturation: 200, contrast: 140 } },
  { name: 'Cyberpunk', filters: { ...initialFilters, hueRotate: 280, saturation: 150, contrast: 120, brightness: 110 } },
  { name: 'Noir', filters: { ...initialFilters, grayscale: 100, contrast: 180, brightness: 80 } },
  { name: 'Vibrant', filters: { ...initialFilters, saturation: 180, contrast: 110 } },
  { name: 'Sharp', filters: { ...initialFilters, sharpen: 50, contrast: 110 } },
];

const cropRatios = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:2', value: 3 / 2 },
];

export default function PhotoEditor() {
  const [image, setImage] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isCropping, setIsCropping] = useState(false);
  
  // Crop state
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setFilters(initialFilters);
        setRotation(0);
        setZoom(1);
        setIsCropping(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation = 0
  ): Promise<string | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    const rotRad = (rotation * Math.PI) / 180;
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
      image.width,
      image.height,
      rotation
    );

    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height
    );

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(data, 0, 0);

    return canvas.toDataURL('image/jpeg');
  };

  const rotateSize = (width: number, height: number, rotation: number) => {
    const rotRad = (rotation * Math.PI) / 180;
    return {
      width:
        Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
      height:
        Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
    };
  };

  const handleApplyCrop = async () => {
    if (image && croppedAreaPixels) {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      if (croppedImage) {
        setImage(croppedImage);
        setIsCropping(false);
        setRotation(0);
        setZoom(1);
      }
    }
  };

  const applyFiltersToCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image || isCropping) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = image;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Simulate sharpening using a convolution matrix or high contrast/brightness tweaks
      // For simplicity in this environment, we use CSS filters.
      // Sharpening isn't a native CSS filter, so we combine contrast and brightness
      const sharpenVal = filters.sharpen / 100;
      
      ctx.filter = `
        brightness(${filters.brightness + (sharpenVal * 10)}%)
        contrast(${filters.contrast + (sharpenVal * 20)}%)
        saturate(${filters.saturation}%)
        blur(${filters.blur}px)
        hue-rotate(${filters.hueRotate}deg)
        grayscale(${filters.grayscale}%)
        sepia(${filters.sepia}%)
        invert(${filters.invert}%)
      `;
      
      ctx.drawImage(img, 0, 0);
    };
  };

  useEffect(() => {
    applyFiltersToCanvas();
  }, [filters, image, isCropping]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = 'lumina-edited-photo.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    const val = Array.isArray(value) ? value[0] : value;
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 border-r border-zinc-800 bg-[#111111] flex flex-col z-20">
        <div className="p-6 border-bottom border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Lumina</h1>
          </div>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Photo Editor Pro</p>
        </div>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="adjust" className="w-full">
            <TabsList className="w-full bg-zinc-900 border border-zinc-800 mb-6 grid grid-cols-3">
              <TabsTrigger value="adjust" className="gap-2 text-[10px] uppercase font-bold">
                <Sun className="w-3 h-3" /> Adjust
              </TabsTrigger>
              <TabsTrigger value="presets" className="gap-2 text-[10px] uppercase font-bold">
                <Palette className="w-3 h-3" /> Filters
              </TabsTrigger>
              <TabsTrigger value="crop" className="gap-2 text-[10px] uppercase font-bold" onClick={() => setIsCropping(true)}>
                <CropIcon className="w-3 h-3" /> Crop
              </TabsTrigger>
            </TabsList>

            <TabsContent value="adjust" className="space-y-6 pb-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Basic</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-100" onClick={resetFilters}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2"><Sun className="w-3 h-3" /> Brightness</span>
                      <span className="font-mono text-zinc-500">{filters.brightness}%</span>
                    </div>
                    <Slider 
                      value={[filters.brightness]} 
                      min={0} max={200} step={1} 
                      onValueChange={(v) => updateFilter('brightness', v)}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2"><ContrastIcon className="w-3 h-3" /> Contrast</span>
                      <span className="font-mono text-zinc-500">{filters.contrast}%</span>
                    </div>
                    <Slider 
                      value={[filters.contrast]} 
                      min={0} max={200} step={1} 
                      onValueChange={(v) => updateFilter('contrast', v)}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2"><Droplets className="w-3 h-3" /> Saturation</span>
                      <span className="font-mono text-zinc-500">{filters.saturation}%</span>
                    </div>
                    <Slider 
                      value={[filters.saturation]} 
                      min={0} max={200} step={1} 
                      onValueChange={(v) => updateFilter('saturation', v)}
                      className="py-2"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-4">
                <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Effects</Label>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2"><Ghost className="w-3 h-3" /> Blur</span>
                      <span className="font-mono text-zinc-500">{filters.blur}px</span>
                    </div>
                    <Slider 
                      value={[filters.blur]} 
                      min={0} max={20} step={0.1} 
                      onValueChange={(v) => updateFilter('blur', v)}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2"><Wind className="w-3 h-3" /> Sharpen</span>
                      <span className="font-mono text-zinc-500">{filters.sharpen}%</span>
                    </div>
                    <Slider 
                      value={[filters.sharpen]} 
                      min={0} max={100} step={1} 
                      onValueChange={(v) => updateFilter('sharpen', v)}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-2"><Palette className="w-3 h-3" /> Hue Rotate</span>
                      <span className="font-mono text-zinc-500">{filters.hueRotate}°</span>
                    </div>
                    <Slider 
                      value={[filters.hueRotate]} 
                      min={0} max={360} step={1} 
                      onValueChange={(v) => updateFilter('hueRotate', v)}
                      className="py-2"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-4">
                <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Color Tones</Label>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Grayscale</span>
                      <span className="font-mono text-zinc-500">{filters.grayscale}%</span>
                    </div>
                    <Slider 
                      value={[filters.grayscale]} 
                      min={0} max={100} step={1} 
                      onValueChange={(v) => updateFilter('grayscale', v)}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Sepia</span>
                      <span className="font-mono text-zinc-500">{filters.sepia}%</span>
                    </div>
                    <Slider 
                      value={[filters.sepia]} 
                      min={0} max={100} step={1} 
                      onValueChange={(v) => updateFilter('sepia', v)}
                      className="py-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Invert</span>
                      <span className="font-mono text-zinc-500">{filters.invert}%</span>
                    </div>
                    <Slider 
                      value={[filters.invert]} 
                      min={0} max={100} step={1} 
                      onValueChange={(v) => updateFilter('invert', v)}
                      className="py-2"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="presets" className="pb-8">
              <div className="grid grid-cols-2 gap-3">
                {presets.map((preset) => (
                  <Button
                    key={preset.name}
                    variant="outline"
                    className={cn(
                      "h-24 flex flex-col items-center justify-center gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all",
                      JSON.stringify(filters) === JSON.stringify(preset.filters) && "border-zinc-100 bg-zinc-800"
                    )}
                    onClick={() => setFilters(preset.filters)}
                  >
                    <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center overflow-hidden">
                      {image ? (
                        <img 
                          src={image} 
                          alt={preset.name} 
                          className="w-full h-full object-cover"
                          style={{
                            filter: `
                              brightness(${preset.filters.brightness}%)
                              contrast(${preset.filters.contrast}%)
                              saturate(${preset.filters.saturation}%)
                              grayscale(${preset.filters.grayscale}%)
                              sepia(${preset.filters.sepia}%)
                              hue-rotate(${preset.filters.hueRotate}deg)
                            `
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="crop" className="space-y-6 pb-8">
              <div className="space-y-4">
                <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Aspect Ratio</Label>
                <div className="grid grid-cols-3 gap-2">
                  {cropRatios.map((ratio) => (
                    <Button
                      key={ratio.label}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "text-[10px] font-bold bg-zinc-900 border-zinc-800",
                        aspect === ratio.value && "bg-zinc-100 text-black border-zinc-100"
                      )}
                      onClick={() => setAspect(ratio.value)}
                    >
                      {ratio.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Rotation</Label>
                  <span className="font-mono text-[10px] text-zinc-500">{rotation}°</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-zinc-900 border-zinc-800 gap-2 text-[10px] font-bold"
                    onClick={() => setRotation(prev => (prev - 90) % 360)}
                  >
                    <RotateCcw className="w-3 h-3" /> -90°
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-zinc-900 border-zinc-800 gap-2 text-[10px] font-bold"
                    onClick={() => setRotation(prev => (prev + 90) % 360)}
                  >
                    <RotateCw className="w-3 h-3" /> +90°
                  </Button>
                </div>
                <Slider 
                  value={[rotation]} 
                  min={-180} max={180} step={1} 
                  onValueChange={(v) => setRotation(v[0])}
                  className="py-2"
                />
              </div>

              <Separator className="bg-zinc-800" />

              <div className="space-y-4">
                <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Zoom</Label>
                <Slider 
                  value={[zoom]} 
                  min={1} max={3} step={0.1} 
                  onValueChange={(v) => setZoom(v[0])}
                  className="py-2"
                />
              </div>

              <div className="pt-4 flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-zinc-800 hover:bg-zinc-900"
                  onClick={() => setIsCropping(false)}
                >
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button 
                  className="flex-1 bg-zinc-100 text-black hover:bg-zinc-200 font-bold"
                  onClick={handleApplyCrop}
                >
                  <Check className="w-4 h-4 mr-2" /> Apply Crop
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <div className="p-6 border-t border-zinc-800 bg-[#0d0d0d]">
          <Button 
            className="w-full bg-zinc-100 text-black hover:bg-zinc-200 font-bold"
            disabled={!image || isCropping}
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" /> Export Image
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-zinc-800 bg-[#111111]/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger 
                  className="inline-flex items-center justify-center rounded-lg size-8 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer transition-colors border-none bg-transparent" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5" />
                </TooltipTrigger>
                <TooltipContent>Upload Image</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="h-4 w-[1px] bg-zinc-800" />
            
            <div className="flex items-center gap-1">
              <Button 
                variant={isCropping ? "secondary" : "ghost"} 
                size="sm" 
                className={cn("gap-2 text-[10px] uppercase font-bold", isCropping ? "bg-zinc-100 text-black" : "text-zinc-400 hover:text-zinc-100")} 
                disabled={!image}
                onClick={() => setIsCropping(!isCropping)}
              >
                <CropIcon className="w-4 h-4" /> Crop & Rotate
              </Button>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-100 gap-2 text-[10px] uppercase font-bold" disabled={!image}>
                <Undo className="w-4 h-4" /> Undo
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            {image ? (
              <Button variant="destructive" size="sm" onClick={() => setImage(null)} className="h-8 text-[10px] uppercase font-bold">
                <Trash2 className="w-4 h-4 mr-2" /> Clear
              </Button>
            ) : (
              <Button size="sm" onClick={() => fileInputRef.current?.click()} className="bg-zinc-100 text-black hover:bg-zinc-200 h-8 text-[10px] uppercase font-bold">
                <Upload className="w-4 h-4 mr-2" /> Open File
              </Button>
            )}
          </div>
        </header>

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden relative bg-[#050505] pattern-grid flex items-center justify-center">
          <AnimatePresence mode="wait">
            {image ? (
              <motion.div
                key={image + isCropping}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full h-full flex items-center justify-center p-12"
              >
                {isCropping ? (
                  <div className="relative w-full h-full max-w-4xl max-h-[calc(100vh-200px)]">
                    <Cropper
                      image={image}
                      crop={crop}
                      zoom={zoom}
                      rotation={rotation}
                      aspect={aspect}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      onRotationChange={setRotation}
                    />
                  </div>
                ) : (
                  <div className="relative shadow-2xl shadow-black/50">
                    <canvas 
                      ref={canvasRef} 
                      className="max-w-full max-h-[calc(100vh-160px)] object-contain rounded-sm"
                      style={{
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.1)'
                      }}
                    />
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-6 max-w-md"
              >
                <div className="w-24 h-24 bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <ImageIcon className="w-10 h-10 text-zinc-700" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">No image selected</h2>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    Start by uploading a photo to apply professional filters and adjustments. 
                    Supports PNG, JPG, and WebP.
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-100 text-black hover:bg-zinc-200 px-8 py-6 rounded-2xl font-bold text-lg"
                >
                  <Upload className="w-5 h-5 mr-3" /> Select Photo
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Status Bar */}
        <footer className="h-10 border-t border-zinc-800 bg-[#111111] flex items-center justify-between px-6 text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
          <div className="flex gap-6">
            <span>Status: {image ? (isCropping ? 'Cropping' : 'Ready') : 'Idle'}</span>
            {image && <span>Format: PNG/JPG</span>}
          </div>
          <div className="flex gap-6">
            <span>© 2026 Lumina Labs</span>
            <span>v1.1.0</span>
          </div>
        </footer>
      </main>

      <style>{`
        .pattern-grid {
          background-image: radial-gradient(circle at 1px 1px, #1a1a1a 1px, transparent 0);
          background-size: 40px 40px;
        }
        
        /* Cropper Customization */
        .react-easy-crop_Container {
          background-color: #050505 !important;
        }
        .react-easy-crop_CropArea {
          color: rgba(255, 255, 255, 0.5) !important;
          border: 1px solid rgba(255, 255, 255, 0.8) !important;
        }
      `}</style>
    </div>
  );
}

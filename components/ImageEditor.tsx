import React, { useState, useRef } from 'react';
import { Upload, Wand2, Download, Image as ImageIcon, Loader2, RefreshCw, Sparkles, MoveRight, WifiOff } from 'lucide-react';
import { editImageWithGemini } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t.errorImage);
      return;
    }

    setMimeType(file.type);
    setError(null);
    setGeneratedImage(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Reset file input to allow selecting the same file again if needed
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!isOnline) {
        setError("Internet connection required.");
        return;
    }
    if (!originalImage || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const base64Data = originalImage.split(',')[1];
      const resultBase64 = await editImageWithGemini(base64Data, mimeType, prompt);
      
      if (resultBase64) {
        setGeneratedImage(`data:image/png;base64,${resultBase64}`);
      } else {
        setError(t.errorGen);
      }
    } catch (err) {
      setError(t.errorConnection);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `nano-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const useAsInput = () => {
      if(generatedImage) {
          setOriginalImage(generatedImage);
          setGeneratedImage(null);
          setMimeType('image/png');
      }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-white md:rounded-3xl">
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-fuchsia-600 p-8 text-white shrink-0 shadow-lg">
        <div className="absolute -right-4 -bottom-8 opacity-20 text-white">
            <Sparkles size={120} />
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-3 relative z-10">
          <Wand2 size={28} className="text-yellow-300" />
          {t.studioHeader}
        </h1>
        <p className="text-violet-100 text-sm mt-2 font-medium opacity-90 relative z-10">
          {t.studioSubHeader}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-32 md:pb-6">
        <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
            
            {/* Upload Area */}
            {!originalImage ? (
            <div className="flex-1 flex flex-col justify-center min-h-[400px]">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex-1 border-3 border-dashed border-slate-300 rounded-[2rem] bg-white flex flex-col items-center justify-center text-slate-400 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl w-full max-w-2xl mx-auto"
                >
                    <div className="p-6 bg-slate-50 rounded-full mb-6 group-hover:bg-white group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <Upload size={48} className="opacity-50 group-hover:opacity-100" />
                    </div>
                    <p className="font-bold text-xl mb-2">{t.uploadPrompt}</p>
                    <p className="text-base text-slate-400">{t.uploadSubPrompt}</p>
                    <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                    />
                </div>
            </div>
            ) : (
            <div className="flex flex-col h-full">
                {/* Desktop: Side by Side Grid / Mobile: Stacked */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start h-full">
                
                {/* Original Image Card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-700 mb-4 px-1">
                        <span className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg"><ImageIcon size={16}/> {t.originalImage}</span>
                        <button 
                            onClick={() => {
                            setOriginalImage(null); 
                            setGeneratedImage(null);
                            setPrompt('');
                            }}
                            className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors px-3 py-1.5 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100"
                        >
                            {t.reset}
                        </button>
                    </div>
                    <div className="flex-1 min-h-[250px] bg-slate-100/50 rounded-xl overflow-hidden relative border border-slate-100 flex items-center justify-center group">
                        <img src={originalImage} alt="Original" className="max-w-full max-h-[50vh] object-contain shadow-md" />
                        <div className="absolute top-1/2 -right-3 lg:flex hidden items-center justify-center w-8 h-8 bg-white rounded-full shadow-md z-10 text-slate-400">
                             <MoveRight size={16} />
                        </div>
                    </div>
                </div>

                {/* Result Area */}
                <div className="bg-white p-5 rounded-2xl shadow-md border border-violet-100 relative overflow-hidden h-full flex flex-col ring-1 ring-violet-50">
                    {!generatedImage && isLoading && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-2xl">
                            <Loader2 size={48} className="animate-spin text-violet-600 mb-4" />
                            <p className="text-base font-bold text-violet-700 animate-pulse">{t.processing}</p>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-sm font-bold text-violet-700 mb-4 px-1">
                        <span className="flex items-center gap-2 bg-violet-50 px-3 py-1.5 rounded-lg"><Sparkles size={16}/> {t.aiResult}</span>
                        {generatedImage && (
                            <button onClick={useAsInput} className='text-xs flex items-center gap-1.5 hover:underline font-medium bg-violet-50 px-3 py-1.5 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors'>
                                <RefreshCw size={12}/> {t.useAsInput}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 min-h-[250px] bg-slate-50/50 rounded-xl overflow-hidden relative border-2 border-dashed border-violet-100 flex items-center justify-center">
                        {generatedImage ? (
                            <img src={generatedImage} alt="Generated" className="max-w-full max-h-[50vh] object-contain shadow-lg animate-fade-in" />
                        ) : (
                            <div className="text-center text-slate-300">
                                <Wand2 size={48} className="mx-auto mb-2 opacity-20"/>
                                <p className="text-sm font-medium">{t.resultPlaceholder}</p>
                            </div>
                        )}
                    </div>
                    
                    {generatedImage && (
                        <button 
                            onClick={handleDownload}
                            className="w-full mt-4 py-3 bg-violet-100 text-violet-700 rounded-xl hover:bg-violet-200 transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-sm"
                        >
                            <Download size={18} /> {t.download}
                        </button>
                    )}
                </div>
                </div>
            </div>
            )}
        </div>
      </div>

      {/* Controls - Fixed at bottom for mobile, sticky for Desktop */}
      {originalImage && (
        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_30px_rgba(0,0,0,0.08)] rounded-t-[2rem] z-30 md:static md:rounded-none md:border-t-0 md:bg-transparent md:shadow-none">
            <div className="max-w-4xl mx-auto w-full">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">
                    {t.promptLabel}
                </label>
                <div className="flex gap-3">
                    <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={isOnline ? t.promptPlaceholder : "Offline mode - Cannot generate"}
                    className="flex-1 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm shadow-sm"
                    disabled={isLoading || !isOnline}
                    onKeyDown={(e) => { if(e.key === 'Enter') handleGenerate() }}
                    />
                    <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim() || !isOnline}
                    className={`px-6 py-3.5 rounded-2xl text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-violet-500/20 ${
                        isLoading || !prompt.trim() || !isOnline
                        ? 'bg-slate-300 shadow-none cursor-not-allowed'
                        : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:scale-105 active:scale-95'
                    }`}
                    >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : !isOnline ? <WifiOff size={20} /> : <Wand2 size={20} />}
                    <span className="hidden sm:inline">{isLoading ? t.generating : !isOnline ? "Offline" : t.generate}</span>
                    </button>
                </div>
                {error && (
                    <p className="text-red-500 text-xs mt-3 font-medium px-1 animate-fade-in flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span> {error}
                    </p>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
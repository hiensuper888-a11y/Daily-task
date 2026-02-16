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
    <div className="flex flex-col h-full bg-transparent">
      {/* Light Glass Header */}
      <div className="px-6 py-6 pb-2">
        <div className="flex items-center gap-3 mb-1">
             <div className="w-10 h-10 rounded-2xl bg-white/40 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-sm">
                 <Wand2 size={20} className="text-fuchsia-600" />
             </div>
             <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                {t.studioHeader}
                </h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                {t.studioSubHeader}
                </p>
             </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-32 md:pb-6">
        <div className="max-w-7xl mx-auto w-full h-full flex flex-col">
            
            {/* Upload Area */}
            {!originalImage ? (
            <div className="flex-1 flex flex-col justify-center min-h-[400px]">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex-1 border-2 border-dashed border-white/50 rounded-[2.5rem] bg-white/30 backdrop-blur-md flex flex-col items-center justify-center text-slate-400 hover:border-violet-400 hover:text-violet-600 hover:bg-white/50 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl w-full max-w-2xl mx-auto"
                >
                    <div className="p-6 bg-white/50 rounded-full mb-6 group-hover:bg-white group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-white/60">
                        <Upload size={48} className="opacity-50 group-hover:opacity-100 text-violet-500" />
                    </div>
                    <p className="font-bold text-xl mb-2 text-slate-700">{t.uploadPrompt}</p>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wide">{t.uploadSubPrompt}</p>
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
                <div className="bg-white/60 backdrop-blur-md p-5 rounded-[2rem] shadow-sm border border-white/50 h-full flex flex-col">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-700 mb-4 px-1">
                        <span className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg border border-white/50"><ImageIcon size={16}/> {t.originalImage}</span>
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
                    <div className="flex-1 min-h-[250px] bg-slate-100/50 rounded-2xl overflow-hidden relative border border-slate-100 flex items-center justify-center group">
                        <img src={originalImage} alt="Original" className="max-w-full max-h-[50vh] object-contain shadow-md rounded-lg" />
                        <div className="absolute top-1/2 -right-3 lg:flex hidden items-center justify-center w-8 h-8 bg-white rounded-full shadow-md z-10 text-slate-400">
                             <MoveRight size={16} />
                        </div>
                    </div>
                </div>

                {/* Result Area */}
                <div className="bg-white/60 backdrop-blur-md p-5 rounded-[2rem] shadow-md border border-white/50 relative overflow-hidden h-full flex flex-col ring-1 ring-white/40">
                    {!generatedImage && isLoading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-[2rem]">
                            <Loader2 size={48} className="animate-spin text-violet-600 mb-4" />
                            <p className="text-base font-bold text-violet-700 animate-pulse">{t.processing}</p>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-sm font-bold text-violet-700 mb-4 px-1">
                        <span className="flex items-center gap-2 bg-violet-50 px-3 py-1.5 rounded-lg border border-violet-100"><Sparkles size={16}/> {t.aiResult}</span>
                        {generatedImage && (
                            <button onClick={useAsInput} className='text-xs flex items-center gap-1.5 hover:underline font-medium bg-violet-50 px-3 py-1.5 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors'>
                                <RefreshCw size={12}/> {t.useAsInput}
                            </button>
                        )}
                    </div>

                    <div className="flex-1 min-h-[250px] bg-slate-50/50 rounded-2xl overflow-hidden relative border-2 border-dashed border-violet-200 flex items-center justify-center">
                        {generatedImage ? (
                            <img src={generatedImage} alt="Generated" className="max-w-full max-h-[50vh] object-contain shadow-lg animate-fade-in rounded-lg" />
                        ) : (
                            <div className="text-center text-slate-400">
                                <Wand2 size={48} className="mx-auto mb-2 opacity-30"/>
                                <p className="text-sm font-bold opacity-60">{t.resultPlaceholder}</p>
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

      {/* Controls */}
      {originalImage && (
        <div className="fixed bottom-[90px] lg:bottom-6 left-4 right-4 lg:left-[300px] z-[40] pb-safe flex justify-center pointer-events-none">
             <div className="w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2rem] p-2 pl-3 shadow-premium ring-1 ring-white/60 animate-slide-up flex items-center gap-2 pointer-events-auto">
                 <div className="flex-1 relative">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={isOnline ? t.promptPlaceholder : "Offline mode"}
                        className="w-full bg-transparent border-none px-2 py-3 text-[16px] font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 outline-none"
                        disabled={isLoading || !isOnline}
                        onKeyDown={(e) => { if(e.key === 'Enter') handleGenerate() }}
                    />
                 </div>
                 <button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim() || !isOnline}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 shadow-lg ${
                        isLoading || !prompt.trim() || !isOnline
                        ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                        : 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white hover:scale-110 active:scale-95'
                    }`}
                >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} strokeWidth={2.5}/>}
                </button>
             </div>
        </div>
      )}
    </div>
  );
};
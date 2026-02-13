import React, { useState, useRef } from 'react';
import { Upload, Wand2, Download, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { editImageWithGemini } from '../services/geminiService';

export const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple validation
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn một tệp hình ảnh.');
      return;
    }

    setMimeType(file.type);
    setError(null);
    setGeneratedImage(null); // Clear previous result

    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!originalImage || !prompt.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Extract base64 data without prefix (data:image/jpeg;base64,)
      const base64Data = originalImage.split(',')[1];
      
      const resultBase64 = await editImageWithGemini(base64Data, mimeType, prompt);
      
      if (resultBase64) {
        // Construct full data URL for display
        setGeneratedImage(`data:image/png;base64,${resultBase64}`);
      } else {
        setError('Không thể tạo hình ảnh. Vui lòng thử lại.');
      }
    } catch (err) {
      setError('Đã xảy ra lỗi khi kết nối với AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `edited-image-${Date.now()}.png`;
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
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white shrink-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 size={24} />
          Xưởng Chỉnh Sửa AI
        </h1>
        <p className="text-purple-100 text-sm mt-1">
          Sử dụng Gemini 2.5 để chỉnh sửa ảnh bằng lời nhắc
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* Upload Area */}
        {!originalImage ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-slate-400 hover:border-purple-400 hover:text-purple-500 hover:bg-purple-50 transition-all cursor-pointer h-64"
          >
            <Upload size={48} className="mb-4 opacity-50" />
            <p className="font-medium">Nhấn để tải ảnh lên</p>
            <p className="text-xs mt-2 text-slate-400">Hỗ trợ JPG, PNG</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Images Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                   <span>Ảnh gốc</span>
                   <button 
                     onClick={() => {
                        setOriginalImage(null); 
                        setGeneratedImage(null);
                        setPrompt('');
                     }}
                     className="text-xs text-red-500 hover:text-red-700"
                   >
                     Xóa & Tải lại
                   </button>
                </div>
                <div className="aspect-square bg-slate-200 rounded-lg overflow-hidden relative shadow-inner border border-slate-200">
                    <img src={originalImage} alt="Original" className="w-full h-full object-contain" />
                </div>
              </div>

              {generatedImage ? (
                <div className="space-y-2 animate-fade-in">
                  <div className="flex justify-between items-center text-sm font-medium text-purple-600">
                    <span>Kết quả AI</span>
                    <button onClick={useAsInput} className='text-xs flex items-center gap-1 hover:underline'>
                        <RefreshCw size={10}/> Dùng làm ảnh gốc
                    </button>
                  </div>
                  <div className="aspect-square bg-slate-200 rounded-lg overflow-hidden relative shadow-inner border border-purple-200">
                    <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
                  </div>
                  <button 
                    onClick={handleDownload}
                    className="w-full py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Download size={16} /> Tải xuống
                  </button>
                </div>
              ) : (
                <div className="aspect-square bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  {isLoading ? (
                    <div className="text-center">
                      <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-2" />
                      <p className="text-sm text-purple-600">Đang xử lý...</p>
                    </div>
                  ) : (
                    <>
                        <ImageIcon size={32} className="opacity-20 mb-2"/>
                        <p className="text-sm">Kết quả sẽ hiện ở đây</p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky bottom-0">
               <label className="block text-sm font-medium text-slate-700 mb-2">
                 Bạn muốn thay đổi gì?
               </label>
               <div className="flex gap-2">
                 <input
                   type="text"
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   placeholder="Ví dụ: Thêm bộ lọc cổ điển, xóa người ở nền..."
                   className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                   disabled={isLoading}
                   onKeyDown={(e) => { if(e.key === 'Enter') handleGenerate() }}
                 />
                 <button
                   onClick={handleGenerate}
                   disabled={isLoading || !prompt.trim()}
                   className={`px-6 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-all ${
                     isLoading || !prompt.trim()
                       ? 'bg-slate-300 cursor-not-allowed'
                       : 'bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg'
                   }`}
                 >
                   {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                   {isLoading ? 'Đang tạo' : 'Tạo'}
                 </button>
               </div>
               {error && (
                 <p className="text-red-500 text-xs mt-2">{error}</p>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
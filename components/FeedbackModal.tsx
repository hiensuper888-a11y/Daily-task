import React, { useState } from 'react';
import { X, MessageSquareHeart, Star, Send, Sparkles, CheckCircle2 } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      alert('Vui lòng chọn mức độ hài lòng của bạn!');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      
      // Auto close after success
      setTimeout(() => {
        setIsSuccess(false);
        setRating(0);
        setFeedback('');
        onClose();
      }, 2500);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-scale-in relative overflow-hidden border border-white/20 dark:border-white/10">
        
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-bl-full -z-10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-tr-full -z-10 blur-2xl"></div>

        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors z-20"
        >
          <X size={20} />
        </button>

        {isSuccess ? (
          <div className="p-10 flex flex-col items-center justify-center text-center h-[400px] animate-fade-in">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping"></div>
              <CheckCircle2 size={48} className="text-emerald-500 drop-shadow-md" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Cảm ơn bạn!</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs">
              Phản hồi của bạn đã được ghi nhận. Chúng tôi sẽ tiếp tục cải thiện ứng dụng tốt hơn!
            </p>
          </div>
        ) : (
          <div className="p-8 sm:p-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 relative group">
                <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <MessageSquareHeart size={28} className="drop-shadow-md" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  Góp ý ứng dụng <Sparkles size={18} className="text-amber-400" />
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Giúp Daily Task trở nên hoàn hảo hơn
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Rating Section */}
              <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 text-center">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4">
                  Bạn đánh giá trải nghiệm thế nào?
                </p>
                <div className="flex justify-center gap-2 sm:gap-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="relative group p-1 transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star 
                        size={36} 
                        strokeWidth={1.5}
                        className={`transition-all duration-300 ${
                          star <= (hoverRating || rating) 
                            ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                            : 'fill-transparent text-slate-300 dark:text-slate-600'
                        }`} 
                      />
                    </button>
                  ))}
                </div>
                <div className="h-4 mt-2">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest animate-fade-in">
                    {rating === 1 && 'Rất tệ 😢'}
                    {rating === 2 && 'Tệ 😞'}
                    {rating === 3 && 'Bình thường 😐'}
                    {rating === 4 && 'Tốt 🙂'}
                    {rating === 5 && 'Tuyệt vời! 😍'}
                  </span>
                </div>
              </div>

              {/* Feedback Textarea */}
              <div>
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                  Chi tiết góp ý (Tùy chọn)
                </label>
                <div className="relative group">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Bạn muốn chúng tôi thêm tính năng gì hoặc cải thiện điều gì?"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 outline-none transition-all resize-none h-32 custom-scrollbar"
                  />
                  <div className="absolute bottom-3 right-3 text-xs font-bold text-slate-400">
                    {feedback.length}/500
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${
                  isSubmitting || rating === 0
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98] shadow-indigo-500/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send size={20} className={rating > 0 ? 'animate-pulse' : ''} /> Gửi Phản Hồi
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

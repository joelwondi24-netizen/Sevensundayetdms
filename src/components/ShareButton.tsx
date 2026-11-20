import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Mail,
  MessageCircle,
  Printer,
  Send,
  Share2,
  X,
} from 'lucide-react';
import { api } from '../api';
import { printWithAutoFit } from '../utils/printFit';

interface ShareButtonProps {
  title: string;
  summary: string;
  reference?: string;
  moduleName?: string;
  compact?: boolean;
  onShared?: (channel: string) => void;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  summary,
  reference,
  moduleName = 'Document',
  compact = false,
  onShared,
}) => {
  const [open, setOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : 'https://sevensunday.et';
  const fullText = [
    `Seven Sunday ETMS — ${moduleName}`,
    reference ? `Ref: ${reference}` : null,
    `Title: ${title}`,
    '',
    summary,
    '',
    `Link: ${shareUrl}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const encodedText = encodeURIComponent(fullText);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedSubject = encodeURIComponent(`[Seven Sunday] ${reference ? `${reference} — ` : ''}${title}`);

  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const whatsappHref = `https://wa.me/?text=${encodedText}`;
  const mailtoHref = `mailto:${encodeURIComponent(emailTo.trim())}?subject=${encodedSubject}&body=${encodedText}`;

  const logChannelShare = async (channel: string, recipient = '') => {
    try {
      await api.post('/api/share/email', {
        channel,
        recipient,
        subject: `${reference ? `${reference} - ` : ''}${title}`,
      });
    } catch {
      // non-blocking audit log
    }
    onShared?.(channel);
  };

  const handleSendEmailDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedback(null);
    if (!emailTo.trim()) {
      setError('Enter a recipient email address.');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await api.post<{ ok: boolean; smtp_host: string }>('/api/share/email', {
        channel: 'Email',
        recipient: emailTo.trim(),
        subject: `${reference ? `${reference} - ` : ''}${title}`,
        body: fullText,
      });
      setFeedback(`Dispatched & logged via ${res.smtp_host} to ${emailTo.trim()}. You can also open your mail client below.`);
      onShared?.('Email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log email share');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setFeedback('Formatted document summary copied to clipboard.');
      await logChannelShare('Clipboard Copy');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard permission unavailable in this browser.');
    }
  };

  const handleNativeShare = async () => {
    setError(null);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: fullText,
          url: shareUrl,
        });
        setFeedback('Shared via system share sheet.');
        await logChannelShare('Device Share');
      } catch {
        // user cancelled native share
      }
    } else {
      handleDownloadSummary();
    }
  };

  const handleDownloadSummary = async () => {
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(reference || title).replace(/[^a-z0-9-_]+/gi, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback('Downloaded shareable document summary (.txt).');
    await logChannelShare('File Export');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setFeedback(null);
          setError(null);
        }}
        className={`inline-flex items-center gap-1.5 font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 text-xs text-[#18243A] dark:text-slate-200 bg-[#F8FAFC] dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#087CEB]'
            : 'px-3 py-2 text-xs text-[#18243A] dark:text-slate-100 bg-[#F8FAFC] dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#087CEB]'
        }`}
        title="Share via Email, Telegram, WhatsApp or Other"
      >
        <Share2 className="w-3.5 h-3.5 text-[#087CEB]" />
        <span>Share</span>
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-50 bg-[#18243A]/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#172033] dark:text-white truncate">
                  Share Document & File
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {reference ? `${reference} · ` : ''}
                  {title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-500 hover:text-[#172033] dark:hover:text-white rounded-lg"
                aria-label="Close share dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {feedback && (
                <div className="px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                  {feedback}
                </div>
              )}
              {error && (
                <div className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
                  {error}
                </div>
              )}

              {/* Direct Channel Links: Telegram, WhatsApp, Native Share / File, Print */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <a
                  href={telegramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logChannelShare('Telegram')}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] font-semibold text-[#172033] dark:text-white transition-colors"
                >
                  <Send className="w-4 h-4 text-[#087CEB]" />
                  <span>Telegram</span>
                </a>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logChannelShare('WhatsApp')}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-600 font-semibold text-[#172033] dark:text-white transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] font-semibold text-[#172033] dark:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#18243A] dark:text-[#38BDF8]" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-[#F8FAFC] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#087CEB] font-semibold text-[#172033] dark:text-white transition-colors"
                >
                  <Share2 className="w-4 h-4 text-[#087CEB]" />
                  <span>Other Apps</span>
                </button>
              </div>

              {/* Email Dispatch Form + Mailto Link */}
              <form onSubmit={handleSendEmailDispatch} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                  Send by Email (Corporate SMTP Log & Mail Client)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    placeholder="recipient@company.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#087CEB]"
                  />
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#087CEB] hover:bg-[#0265C4] rounded-lg whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {sendingEmail ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <a
                    href={mailtoHref}
                    onClick={() => logChannelShare('Email Client', emailTo)}
                    className="text-[#087CEB] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Open in Default Mail App
                  </a>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadSummary}
                      className="text-slate-600 dark:text-slate-300 hover:text-[#087CEB] font-semibold inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download File (.txt)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        window.setTimeout(() => {
                          const isLandscape = Boolean(
                            document.querySelector(
                              '.print-only-container .a4-landscape-sheet, .print-only-container[data-print-orientation="landscape"]'
                            )
                          );
                          printWithAutoFit({
                            orientation: isLandscape ? 'landscape' : 'portrait',
                            targetSelector: '.print-only-container[data-print-active="true"]',
                          });
                        }, 80);
                      }}
                      className="text-[#18243A] dark:text-[#38BDF8] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print / Save PDF
                    </button>
                  </div>
                </div>
              </form>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Share Message Preview</div>
                <pre className="p-2.5 text-[11px] font-mono bg-[#F8FAFC] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg max-h-28 overflow-y-auto whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {fullText}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

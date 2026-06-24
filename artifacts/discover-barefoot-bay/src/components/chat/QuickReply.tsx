import React from 'react';

interface QuickReplyProps {
  text: string;
  onClick: () => void;
}

const QuickReply: React.FC<QuickReplyProps> = ({ text, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 transition-colors text-sm"
    >
      {text}
    </button>
  );
};

export default QuickReply;
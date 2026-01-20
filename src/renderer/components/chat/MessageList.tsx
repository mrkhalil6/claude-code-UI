import React from 'react';
import { Message } from './Message';
import { ChatMessage } from '../../store/slices/chat.slice';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: ChatMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className={styles.list}>
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  );
};

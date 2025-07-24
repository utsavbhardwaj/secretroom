# SecureChat - Anonymous Temporary Chat Rooms

## Overview

SecureChat is a privacy-focused, mobile-first real-time chat application that creates temporary, anonymous chat rooms. The application emphasizes security and ephemeral communication with automatic room expiration and privacy protection features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Type**: Single Page Application (SPA) with vanilla JavaScript
- **Structure**: Component-based architecture with custom routing
- **Privacy-First Design**: Mobile-only access with comprehensive privacy protection
- **Real-Time Communication**: WebSocket client for bidirectional messaging
- **State Management**: Component-level state with API integration

### Backend Architecture
- **Framework**: Express.js server with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Real-Time**: Native WebSocket server for instant messaging
- **Session Management**: Session-based user tracking without persistent accounts

## Key Components

### Chat Room System
- **Room Generation**: 8-digit numeric room codes for easy sharing
- **Expiration System**: Configurable room timeouts (default 15 minutes)
- **Member Management**: Real-time member tracking with admin controls
- **QR Code Sharing**: Visual room code sharing for mobile accessibility

### Privacy and Security
- **Screenshot Protection**: Detection and prevention of screenshot attempts
- **Content Protection**: Disabled text selection, context menus, and copy operations
- **Privacy Overlay**: Visual protection when suspicious activity is detected
- **Mobile-Only Access**: Enforced mobile device requirement for enhanced security
- **Anonymous Identity**: Session-based users without persistent accounts

### Real-Time Messaging
- **WebSocket Integration**: Persistent connections for instant communication
- **Message Encryption**: Client-side AES-GCM encryption support
- **Typing Indicators**: Live typing status updates
- **Message History**: Temporary storage during room lifetime
- **User Presence**: Real-time member status tracking

### Administrative Features
- **Admin Panel**: Room creators have full administrative control
- **Member Management**: Ability to kick non-admin members
- **Room Settings**: Configurable duration, member limits, and security features
- **Admin Identification**: Visual indicators (crown icons) for administrators

## Data Flow

### Room Creation Flow
1. User selects "Create Room" action
2. Configures room settings (duration, member limit, security options)
3. Backend generates unique 8-digit room code
4. Room stored in database with expiration timestamp
5. Creator becomes admin and receives shareable room code

### Room Joining Flow
1. User enters 8-digit room code or scans QR code
2. Backend validates room exists and is active
3. User added to room members table
4. WebSocket connection established
5. Real-time messaging begins

### Message Flow
1. User types message in chat interface
2. Message encrypted client-side (if enabled)
3. Sent via WebSocket to server
4. Server validates and stores message
5. Message broadcasted to all room members
6. Messages displayed in real-time chat interface

### Cleanup Flow
1. Automated cleanup service runs every 5 minutes
2. Expired rooms marked as inactive
3. Room members disconnected via WebSocket
4. Messages and room data purged based on retention policies

## External Dependencies

### Database
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database queries and migrations
- **Connection Pool**: Managed database connections

### WebSocket
- **ws Library**: Native WebSocket server implementation
- **Connection Management**: Heartbeat monitoring and reconnection logic

### Development Tools
- **dotenv**: Environment variable management
- **Express.js**: HTTP server framework

## Deployment Strategy

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- Port configuration via `PORT` environment variable (default: 8000)
- Development vs production environment detection

### Static Asset Serving
- CSS and JavaScript files served from `/public` directory
- Single HTML entry point for SPA routing
- Security headers applied to all responses

### Database Management
- Automated schema migrations via Drizzle Kit
- Periodic cleanup of expired data
- Connection pooling for efficient resource usage

### Security Headers
- Content Security Policy for XSS protection
- Frame options to prevent clickjacking
- CORS configuration for development environment
- Referrer policy for privacy protection

### Scalability Considerations
- In-memory WebSocket connection management
- Database connection pooling
- Automatic cleanup to prevent data accumulation
- Session-based architecture allows horizontal scaling
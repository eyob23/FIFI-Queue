# 🔒 FIFI-Queue: Secure Autosaving Form System

A production-ready TypeScript + Vite React application demonstrating a secure, resilient autosaving form system with offline capabilities, FIFO queue management, and encryption. Built with Redux Toolkit and react-hook-form for optimal performance and user experience.

## ✨ Features

### 🔐 Security & Encryption
- **Client-side encryption** using AES encryption for sensitive form data
- **No PII in localStorage** - all data stored in memory with Redux Toolkit
- **Secure data transmission** to backend services

### 🚀 Resilient Autosaving
- **Debounced autosave** (1-second delay) to prevent excessive API calls
- **Offline-safe operations** with automatic retry mechanisms
- **FIFO queue management** ensuring save order is guaranteed
- **Multi-tab coordination** through Redux state management

### 📱 Offline Support
- **Automatic online/offline detection** using browser APIs
- **Queue persistence** during offline periods
- **Automatic sync** when connection is restored
- **Visual status indicators** for connection state

### 🔄 Queue Management
- **First-In-First-Out (FIFO)** processing ensures data integrity
- **Retry mechanisms** with exponential backoff
- **Failure handling** with intelligent queue reordering
- **Real-time queue status** and monitoring

### 🛠 Development Tools
- **Mock backend service** with configurable failure rates
- **Backend control panel** for testing error scenarios
- **Real-time debugging** information and queue status
- **Comprehensive logging** for troubleshooting

## 🚀 Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm or yarn package manager

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Open in browser**
   ```
   http://localhost:5173
   ```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🧪 Testing the System

### Mock Backend Control Panel

The application includes a comprehensive backend control panel for testing various scenarios:

#### 🎛 Available Controls
- **Server Status**: Toggle between online/offline states
- **Failure Rate**: Adjust probability of save failures (0-100%)
- **Response Delay**: Configure network latency simulation
- **Quick Scenarios**: Pre-configured test scenarios

#### 📊 Test Scenarios

1. **Normal Operation** (😊)
   - 30% failure rate, 500-2000ms response time

2. **Poor Network** (🌐)
   - 60% failure rate, 3000-8000ms response time

3. **High Failures** (⚠️)
   - 80% failure rate, tests retry mechanisms

4. **Server Down** (🔴)
   - All requests fail, tests offline queue management

### Testing Workflow

1. **Fill out the form** - Type in name, email, and message fields
2. **Watch autosave indicators** - Status shows real-time save progress
3. **Simulate network issues** - Use control panel to create failures
4. **Go offline** - Disconnect internet to test offline queueing
5. **Monitor queue** - Watch FIFO queue build up and process
6. **Come back online** - Observe automatic sync when reconnected

## 🏗 Architecture

### Core Technologies
- **TypeScript** for type safety and developer experience
- **React 18** with modern hooks and functional components
- **Vite** for lightning-fast development and building
- **Redux Toolkit** for predictable state management
- **react-hook-form** for performant form handling

### Key Features Implemented

✅ **FIFO Queue Management** - Ensures save order is guaranteed  
✅ **Offline-Safe Autosaving** - Works without internet connection  
✅ **Encryption** - Client-side AES encryption for sensitive data  
✅ **Redux Toolkit Integration** - Pure in-memory state (no PII in storage)  
✅ **react-hook-form Integration** - Uses useForm and useWatch  
✅ **Mock Backend with Errors** - Configurable failure scenarios  
✅ **Multi-tab Coordination** - Shared Redux state  
✅ **Guaranteed Delivery** - Automatic retry and sync when online  

## 📁 Project Structure

```
src/
├── components/           # React components
│   ├── AutosaveForm.tsx     # Main form component
│   └── BackendControlPanel.tsx  # Testing control panel
├── hooks/               # Custom React hooks
│   ├── redux.ts            # Type-safe Redux hooks
│   └── useAutosave.ts      # Autosave orchestration
├── services/            # External services
│   └── mockBackend.ts      # Mock backend implementation
├── store/               # Redux store
│   ├── index.ts            # Store configuration
│   └── formSlice.ts        # Form state management
├── types/               # TypeScript definitions
├── utils/               # Utility functions
│   └── encryption.ts       # Encryption/decryption
└── App.tsx              # Main application component
```

## 🔧 Configuration

### Autosave Settings
```typescript
const { saveNow, forceSync } = useAutosave({ 
  control,           // react-hook-form control
  delay: 1000,       // debounce delay in ms
  enabled: true      // enable/disable autosave
});
```

⚠️ **Security Note**: In production, use proper key management systems and environment variables for encryption keys.

## 🚀 Production Considerations

### Security
- Implement proper key management (Azure Key Vault, AWS KMS, etc.)
- Use HTTPS for all communications
- Add request signing and validation

### Performance
- Implement service worker for better offline support
- Add IndexedDB for persistent offline storage
- Optimize bundle size and lazy loading

---

Built with ❤️ for secure, resilient web applications.

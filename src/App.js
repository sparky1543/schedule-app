import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyAJR4DKer4gLCUsxEGk4guqhW8Biv3u5BY",
  authDomain: "schedule-app-d4a72.firebaseapp.com",
  databaseURL: "https://schedule-app-d4a72-default-rtdb.firebaseio.com/",
  projectId: "schedule-app-d4a72",
  storageBucket: "schedule-app-d4a72.firebasestorage.app",
  messagingSenderId: "295551868282",
  appId: "1:295551868282:web:e32d4ff7a349e656578ac3",
  measurementId: "G-LSB019XWXB"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const ScheduleApp = () => {
  const [scheduleData, setScheduleData] = useState({});
  const [selectedSlots, setSelectedSlots] = useState(new Set());
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // 🔥 실시간 Firebase 리스너
  useEffect(() => {
    const schedulesRef = ref(database, 'schedules');
    
    const unsubscribe = onValue(schedulesRef, (snapshot) => {
      const data = snapshot.val();
      setScheduleData(data || {});
      setIsLoading(false);
      console.log('Firebase에서 데이터 불러옴:', data);
    }, (error) => {
      console.error('Firebase 읽기 오류:', error);
      setIsLoading(false);
    });

    // 온라인 상태 감지
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 🔥 Firebase에 즉시 저장
  const saveToFirebase = async (newData) => {
    try {
      const schedulesRef = ref(database, 'schedules');
      await set(schedulesRef, newData);
      console.log('Firebase 저장 성공!', newData);
    } catch (error) {
      console.error('Firebase 저장 실패:', error);
      throw error;
    }
  };

  // 7월 1일부터 8월 31일까지의 날짜 생성 (일요일부터 시작하는 달력 형태)
  const generateDates = () => {
    const dates = [];
    
    // 7월 달력 생성
    const july2025 = generateMonthCalendar(2025, 7);
    // 8월 달력 생성  
    const august2025 = generateMonthCalendar(2025, 8);
    
    return { july: july2025, august: august2025 };
  };

  // 월별 달력 생성 함수 (일요일부터 시작)
  const generateMonthCalendar = (year, month) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDate = new Date(firstDay);
    
    // 첫 번째 날이 일요일이 아니면 이전 월의 날짜로 채우기
    const dayOfWeek = firstDay.getDay(); // 0 = 일요일
    startDate.setDate(startDate.getDate() - dayOfWeek);
    
    const calendar = [];
    const currentDate = new Date(startDate);
    
    // 6주 * 7일 = 42칸으로 달력 생성
    for (let i = 0; i < 42; i++) {
      const isCurrentMonth = currentDate.getMonth() === month - 1;
      const isInRange = isCurrentMonth && currentDate.getDate() >= 1;
      
      calendar.push({
        date: currentDate.toISOString().split('T')[0],
        display: currentDate.getDate(),
        dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][currentDate.getDay()],
        isCurrentMonth: isCurrentMonth,
        isInRange: isInRange,
        month: currentDate.getMonth() + 1
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return calendar;
  };

  const { july: julyDates, august: augustDates } = generateDates();

  // 유효한 날짜인지 확인 (7-8월 범위 내)
  const isValidDate = (date) => {
    const allValidDates = [...julyDates, ...augustDates]
      .filter(d => d.isInRange)
      .map(d => d.date);
    return allValidDates.includes(date);
  };

  // 두 날짜 사이의 모든 날짜 배열 반환
  const getDateRange = (startDate, endDate) => {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 시작과 끝 날짜 정렬
      const actualStart = start <= end ? start : end;
      const actualEnd = start <= end ? end : start;
      
      const dates = [];
      const current = new Date(actualStart);
      
      while (current <= actualEnd) {
        const dateStr = current.toISOString().split('T')[0];
        if (isValidDate(dateStr)) {
          dates.push(dateStr);
        }
        current.setDate(current.getDate() + 1);
      }
      
      return dates;
    } catch (error) {
      return [];
    }
  };

  // 드래그 중 미리보기를 위한 함수
  const isInDragRange = (date) => {
    if (!isDragging || !dragStart || !dragEnd || !isValidDate(date)) return false;
    try {
      const rangeDates = getDateRange(dragStart, dragEnd);
      return rangeDates.includes(date);
    } catch (error) {
      return false;
    }
  };

  // 터치/드래그 시작 (모바일 + 데스크톱 지원)
  const handleStart = (date, event) => {
    if (!isValidDate(date)) return;
    
    // 기본 동작 방지 (스크롤, 선택 등)
    if (event && event.type === 'touchstart') {
      event.preventDefault();
    }
    
    setIsDragging(true);
    setDragStart(date);
    setDragEnd(date);
  };

  // 터치/드래그 중 (모바일 + 데스크톱 지원)
  const handleMove = (date, event) => {
    if (!isDragging || !isValidDate(date)) return;
    
    if (event && event.type === 'touchmove') {
      event.preventDefault();
    }
    
    setDragEnd(date);
  };

  // 터치/드래그 끝 (모바일 + 데스크톱 지원)
  const handleEnd = (event) => {
    if (!isDragging) return;

    if (event && event.type === 'touchend') {
      event.preventDefault();
    }

    // 시작점과 끝점이 같으면 단일 클릭/탭으로 처리
    if (dragStart === dragEnd) {
      const newSelectedSlots = new Set(selectedSlots);
      if (newSelectedSlots.has(dragStart)) {
        newSelectedSlots.delete(dragStart);
      } else {
        newSelectedSlots.add(dragStart);
      }
      setSelectedSlots(newSelectedSlots);
    } else if (dragStart && dragEnd) {
      // 드래그 범위의 모든 날짜 선택
      const rangeDates = getDateRange(dragStart, dragEnd);
      const newSelectedSlots = new Set(selectedSlots);
      
      // 범위 내 첫 번째 날짜가 선택되어 있는지 확인하여 일괄 토글
      const shouldSelect = !selectedSlots.has(dragStart);
      
      rangeDates.forEach(date => {
        if (shouldSelect) {
          newSelectedSlots.add(date);
        } else {
          newSelectedSlots.delete(date);
        }
      });
      
      setSelectedSlots(newSelectedSlots);
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // 단일 날짜 클릭/탭 (웹 전용 - 백업용)
  const handleDateClick = (date, event) => {
    if (!isValidDate(date)) return;
    
    // 드래그가 진행 중이면 클릭 무시
    if (isDragging) return;
    
    // 터치 이벤트는 무시 (handleEnd에서 처리)
    if (event && event.type === 'touchstart') return;
    
    const newSelectedSlots = new Set(selectedSlots);
    if (newSelectedSlots.has(date)) {
      newSelectedSlots.delete(date);
    } else {
      newSelectedSlots.add(date);
    }
    setSelectedSlots(newSelectedSlots);
  };

  // 전역 터치/마우스 업 이벤트 감지
  useEffect(() => {
    const handleGlobalEnd = (event) => {
      if (isDragging) {
        handleEnd(event);
      }
    };

    if (isDragging) {
      // 모바일과 데스크톱 모두 지원
      document.addEventListener('mouseup', handleGlobalEnd);
      document.addEventListener('touchend', handleGlobalEnd, { passive: false });
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDragging, dragStart, dragEnd, selectedSlots]);

  // 이름 입력 시 기존 일정 확인
  useEffect(() => {
    if (name.trim() && scheduleData[name.trim()]) {
      setIsEditing(true);
      // 기존 선택된 날짜들을 불러오기
      const existingDates = scheduleData[name.trim()];
      setSelectedSlots(new Set(existingDates));
    } else {
      setIsEditing(false);
    }
  }, [name, scheduleData]);

  // 히트맵 데이터 계산
  const calculateHeatmapData = () => {
    const heatmapData = {};
    
    // 7월과 8월 모든 날짜에 대해 계산
    [...julyDates, ...augustDates].forEach(dateInfo => {
      if (dateInfo.isInRange) {
        const date = dateInfo.date;
        let count = 0;
        Object.values(scheduleData).forEach(personSchedule => {
          if (personSchedule.includes(date)) {
            count++;
          }
        });
        heatmapData[date] = count;
      }
    });
    
    return heatmapData;
  };

  const heatmapData = calculateHeatmapData();

  // 선택 초기화
  const clearSelection = () => {
    setSelectedSlots(new Set());
  };

  // 편집 취소
  const cancelEdit = () => {
    setName('');
    setSelectedSlots(new Set());
    setIsEditing(false);
  };

  // 일정 제출
  const submitSchedule = async () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요!');
      return;
    }
    
    if (selectedSlots.size === 0) {
      alert('가능한 날짜를 선택해주세요!');
      return;
    }

    setIsSubmitting(true);

    try {
      // 선택된 날짜들을 배열로 변환
      const selectedDates = Array.from(selectedSlots);

      // 기존 데이터가 있는지 확인
      const isExisting = scheduleData[name.trim()];
      
      // 새로운 데이터 생성
      const newScheduleData = {
        ...scheduleData,
        [name.trim()]: selectedDates
      };

      // Firebase에 저장 (실시간으로 모든 기기에 반영됨)
      await saveToFirebase(newScheduleData);

      // 초기화
      setName('');
      setSelectedSlots(new Set());
      setIsEditing(false);
      
      if (isExisting) {
        alert(`${name.trim()}님의 일정이 수정되었습니다! ✏️`);
      } else {
        alert(`${name.trim()}님의 일정이 등록되었습니다! 🎉`);
      }
    } catch (error) {
      alert('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 히트맵 색상 클래스 반환
  const getHeatClass = (count) => {
    return `heat-${Math.min(count, 12)}`;
  };

  // 날짜가 선택되었는지 확인
  const isDateSelected = (date) => {
    return selectedSlots.has(date);
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="mobile-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Firebase에서 데이터를 불러오는 중...</p>
          </div>
        </div>
        <style jsx>{`
          .app-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 0;
            font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          }
          .mobile-container {
            width: 100%;
            max-width: 430px;
            min-height: 100vh;
            background: white;
            display: flex;
            flex-direction: column;
            margin: 0 auto;
          }
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 20px;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4facfe;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="mobile-container">
        <div className="header">
          <h1>📅 일정 조율</h1>
          <div className="instructions">
            <p><strong>사용법:</strong></p>
            <p>1. 이름 입력 → 2. 날짜 클릭 또는 드래그 → 3. 등록!</p>
            <p>💡 <small>같은 이름 입력시 기존 일정이 자동으로 불러와집니다</small></p>
          </div>
        </div>

        <div className="input-section">
          {isEditing && (
            <div className="edit-notice">
              <span className="edit-icon">✏️</span>
              <span className="edit-text">{name}님의 기존 일정을 수정 중입니다</span>
            </div>
          )}
          
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="name-input"
          />
          
          <div className="button-group">
            <button onClick={clearSelection} className="clear-btn">
              🗑️ 선택 초기화
            </button>
            {isEditing && (
              <button onClick={cancelEdit} className="cancel-btn">
                ❌ 편집 취소
              </button>
            )}
            <button 
              onClick={submitSchedule} 
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : (isEditing ? '🔄 일정 수정' : '✅ 일정 등록')}
            </button>
          </div>
        </div>

        <div className="legend">
          <div className="legend-title">참가 가능 인원</div>
          <div className="legend-items">
            {[0, 3, 6, 9, 12].map(count => (
              <div key={count} className="legend-item">
                <div className={`legend-color ${getHeatClass(count)}`}></div>
                <span>{count}명</span>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-wrapper">
          <div className="calendar-scroll">
            <div className="calendar-grid">
              <div className="month-section">
                <h3 className="month-title">7월 2025</h3>
                <div className="weekdays">
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                    <div key={day} className="weekday">{day}</div>
                  ))}
                </div>
                <div className="calendar-month">
                  {julyDates.map((date, index) => {
                    const count = date.isInRange ? (heatmapData[date.date] || 0) : 0;
                    const isSelected = date.isInRange && isDateSelected(date.date);
                    const isInRange = isInDragRange(date.date);
                    return (
                      <div
                        key={index}
                        className={`date-cell ${date.isCurrentMonth ? '' : 'other-month'} ${date.isInRange ? getHeatClass(count) : ''} ${isSelected ? 'selected' : ''} ${isInRange ? 'drag-preview' : ''}`}
                        onMouseDown={(e) => handleStart(date.date, e)}
                        onMouseEnter={(e) => handleMove(date.date, e)}
                        onMouseUp={(e) => handleEnd(e)}
                        onTouchStart={(e) => handleStart(date.date, e)}
                        onTouchMove={(e) => {
                          // 터치 포인트에서 해당하는 엘리먼트 찾기
                          const touch = e.touches[0];
                          const element = document.elementFromPoint(touch.clientX, touch.clientY);
                          if (element && element.closest('.date-cell')) {
                            const cellElement = element.closest('.date-cell');
                            const cellDate = cellElement.getAttribute('data-date');
                            if (cellDate) {
                              handleMove(cellDate, e);
                            }
                          }
                        }}
                        onTouchEnd={(e) => handleEnd(e)}
                        onClick={(e) => handleDateClick(date.date, e)}
                        data-date={date.date}
                        style={{ cursor: date.isInRange ? 'pointer' : 'default' }}
                      >
                        <div className="date-number">{date.display}</div>
                        {count > 0 && date.isInRange && <span className="count">{count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="month-section">
                <h3 className="month-title">8월 2025</h3>
                <div className="weekdays">
                  {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                    <div key={day} className="weekday">{day}</div>
                  ))}
                </div>
                <div className="calendar-month">
                  {augustDates.map((date, index) => {
                    const count = date.isInRange ? (heatmapData[date.date] || 0) : 0;
                    const isSelected = date.isInRange && isDateSelected(date.date);
                    const isInRange = isInDragRange(date.date);
                    return (
                      <div
                        key={index}
                        className={`date-cell ${date.isCurrentMonth ? '' : 'other-month'} ${date.isInRange ? getHeatClass(count) : ''} ${isSelected ? 'selected' : ''} ${isInRange ? 'drag-preview' : ''}`}
                        onMouseDown={(e) => handleStart(date.date, e)}
                        onMouseEnter={(e) => handleMove(date.date, e)}
                        onMouseUp={(e) => handleEnd(e)}
                        onTouchStart={(e) => handleStart(date.date, e)}
                        onTouchMove={(e) => {
                          // 터치 포인트에서 해당하는 엘리먼트 찾기
                          const touch = e.touches[0];
                          const element = document.elementFromPoint(touch.clientX, touch.clientY);
                          if (element && element.closest('.date-cell')) {
                            const cellElement = element.closest('.date-cell');
                            const cellDate = cellElement.getAttribute('data-date');
                            if (cellDate) {
                              handleMove(cellDate, e);
                            }
                          }
                        }}
                        onTouchEnd={(e) => handleEnd(e)}
                        onClick={(e) => handleDateClick(date.date, e)}
                        data-date={date.date}
                        style={{ cursor: date.isInRange ? 'pointer' : 'default' }}
                      >
                        <div className="date-number">{date.display}</div>
                        {count > 0 && date.isInRange && <span className="count">{count}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="participants">
          <h3>👥 참가자 ({Object.keys(scheduleData).length}명)</h3>
          <div className="participant-list">
            {Object.keys(scheduleData).length === 0 ? (
              <p className="no-participants">아직 참가자가 없어요 🥲</p>
            ) : (
              Object.keys(scheduleData).map(participantName => (
                <div 
                  key={participantName} 
                  className={`participant-item ${participantName === name.trim() ? 'editing' : ''}`}
                  onClick={() => {
                    setName(participantName);
                    setIsEditing(true);
                    setSelectedSlots(new Set(scheduleData[participantName]));
                  }}
                >
                  {participantName}
                  {participantName === name.trim() && <span className="edit-indicator">✏️</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');

        .app-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 0;
          font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
        }

        @media (min-width: 768px) {
          .app-container {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 20px;
          }
        }

        .mobile-container {
          width: 100%;
          max-width: 430px;
          min-height: 100vh;
          background: white;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 768px) {
          .mobile-container {
            border-radius: 24px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            min-height: calc(100vh - 40px);
            overflow: hidden;
          }
        }

        .header {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          padding: 20px;
          text-align: center;
        }

        .header h1 {
          margin: 0 0 15px 0;
          font-size: 24px;
          font-weight: 700;
        }

        .instructions {
          background: rgba(255,255,255,0.2);
          border-radius: 16px;
          padding: 15px;
          backdrop-filter: blur(10px);
        }

        .instructions p {
          margin: 5px 0;
          font-size: 14px;
          line-height: 1.4;
        }

        .input-section {
          padding: 20px;
          background: #f8f9ff;
          border-bottom: 1px solid #e0e6ff;
        }

        .edit-notice {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 10px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .edit-icon {
          font-size: 16px;
        }

        .edit-text {
          font-size: 14px;
          color: #856404;
          font-weight: 500;
        }

        .name-input {
          width: 100%;
          padding: 16px;
          border: 2px solid #e0e6ff;
          border-radius: 12px;
          font-size: 16px;
          margin-bottom: 15px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .name-input:focus {
          outline: none;
          border-color: #4facfe;
        }

        .button-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .clear-btn, .cancel-btn, .submit-btn {
          flex: 1;
          min-width: 100px;
          padding: 12px;
          border: none;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .clear-btn {
          background: #f1f3f4;
          color: #5f6368;
        }

        .clear-btn:hover {
          background: #e8eaed;
        }

        .cancel-btn {
          background: #fee;
          color: #d93025;
        }

        .cancel-btn:hover {
          background: #fdd;
        }

        .submit-btn {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .legend {
          padding: 15px 20px;
          background: white;
          border-bottom: 1px solid #e0e6ff;
        }

        .legend-title {
          font-size: 12px;
          font-weight: 600;
          color: #5f6368;
          margin-bottom: 10px;
          text-align: center;
        }

        .legend-items {
          display: flex;
          justify-content: space-between;
          gap: 4px;
        }

        .legend-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .legend-color {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 1px solid #e0e6ff;
        }

        .legend-item span {
          font-size: 10px;
          color: #5f6368;
        }

        .calendar-wrapper {
          flex: 1;
          overflow: hidden;
          padding: 0 20px 20px 20px;
        }

        .calendar-scroll {
          overflow: auto;
          max-height: 60vh;
          border-radius: 12px;
          border: 1px solid #e0e6ff;
          background: white;
        }

        .calendar-grid {
          padding: 20px;
        }

        .month-section {
          margin-bottom: 30px;
        }

        .month-title {
          color: #333;
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 15px 0;
          text-align: center;
          padding: 10px;
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          border-radius: 8px;
        }

        .weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: #e0e6ff;
          border-radius: 8px 8px 0 0;
          overflow: hidden;
        }

        .weekday {
          background: #f8f9ff;
          color: #5f6368;
          font-weight: 600;
          font-size: 12px;
          padding: 8px;
          text-align: center;
        }

        .weekday:first-child {
          color: #e53e3e; /* 일요일 빨간색 */
        }

        .weekday:last-child {
          color: #3182ce; /* 토요일 파란색 */
        }

        .calendar-month {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 1px;
          background: #e0e6ff;
          user-select: none; /* 드래그 중 텍스트 선택 방지 */
          touch-action: none; /* 모바일에서 스크롤 방지 */
        }

        .date-cell {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
          position: relative;
          background: white;
          min-height: 40px;
          touch-action: none; /* 모바일 터치 최적화 */
        }

        .date-cell.other-month {
          background: #f8f9fa;
          color: #9aa0a6;
          cursor: default;
        }

        .date-cell:not(.other-month):hover {
          transform: scale(1.05);
          z-index: 5;
        }

        .date-cell.selected {
          background: #4facfe !important;
          color: white;
          font-weight: bold;
        }

        .date-cell.selected::after {
          content: '✓';
          position: absolute;
          top: 2px;
          right: 2px;
          font-size: 10px;
          color: white;
          font-weight: bold;
        }

        .date-cell.drag-preview {
          background: rgba(79, 172, 254, 0.3) !important;
          border: 2px dashed #4facfe !important;
        }

        .date-number {
          font-size: 14px;
          font-weight: 600;
          line-height: 1;
        }

        .count {
          position: absolute;
          bottom: 2px;
          right: 2px;
          font-size: 10px;
          background: rgba(0,0,0,0.1);
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
        }

        /* 히트맵 색상 */
        .heat-0 { background-color: #ffffff; }
        .heat-1 { background-color: #e3f2fd; }
        .heat-2 { background-color: #bbdefb; }
        .heat-3 { background-color: #90caf9; }
        .heat-4 { background-color: #64b5f6; }
        .heat-5 { background-color: #42a5f5; }
        .heat-6 { background-color: #2196f3; }
        .heat-7 { background-color: #1e88e5; }
        .heat-8 { background-color: #1976d2; }
        .heat-9 { background-color: #1565c0; }
        .heat-10 { background-color: #0d47a1; color: white; }
        .heat-11 { background-color: #0d47a1; color: white; }
        .heat-12 { background-color: #0d47a1; color: white; }

        .participants {
          padding: 20px;
          background: #f8f9ff;
          margin-top: auto;
        }

        .participants h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: #333;
        }

        .participant-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .participant-item {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .participant-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(79, 172, 254, 0.3);
        }

        .participant-item.editing {
          background: linear-gradient(135deg, #ffa726 0%, #ff9800 100%);
          animation: pulse 2s infinite;
        }

        .edit-indicator {
          font-size: 10px;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }

        .no-participants {
          color: #9aa0a6;
          font-style: italic;
          text-align: center;
          margin: 20px 0;
        }

        /* 스크롤바 스타일링 */
        .calendar-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .calendar-scroll::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }

        .calendar-scroll::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 10px;
        }

        .calendar-scroll::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};

export default ScheduleApp;
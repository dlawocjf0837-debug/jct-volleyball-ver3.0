// utils/googleSheetsService.ts

// 학생 데이터 타입 정의 (혹시 다른 파일에 있다면 지워도 됩니다)
export interface Student {
    id: string;
    number?: string;
    name?: string;
    gender?: string;
    height?: number | null;
    weight?: number | null;
    endurance?: number | null;    // 셔틀런/오래달리기
    flexibility?: number | null;  // 유연성/좌전굴
    speed?: number | null;        // 50m달리기/순발력
    skill1?: number | null;       // 언더핸드/리시브
    skill2?: number | null;       // 서브/공격
  }
  
  export const parseSheetData = (text: string): Student[] => {
    // 1. 텍스트를 줄바꿈 기준으로 나누기 (빈 줄 제거)
    const rows = text.trim().split(/\r?\n/).filter(row => row.trim() !== '');
    
    // 데이터가 없거나 헤더만 있으면 빈 배열 반환
    if (rows.length < 2) return []; 
  
    // 2. 첫 번째 줄(헤더) 파싱
    const rawHeaders = rows[0].split(/[\t,]/);
    
    // 3. 진짜 라벨 찾기 (뒤에서부터 탐색해서 빈칸이 아닌 첫 번째, 두 번째 단어 찾기)
    // 예: [..., "언더핸드", "메롱", "", ""] -> "메롱", "언더핸드" 추출
    const validHeaders = rawHeaders
      .map((h, i) => ({ text: h.trim(), index: i }))
      .filter(item => item.text !== '');
    
    if (validHeaders.length < 2) return []; // 안전장치
    
    const skill2Info = validHeaders[validHeaders.length - 1]; // 마지막 유효 헤더 (메롱)
    const skill1Info = validHeaders[validHeaders.length - 2]; // 뒤에서 두 번째 (언더핸드)
    
    // 헤더 배열 (기존 매핑 로직용)
    const headers = validHeaders.map(h => h.text);
  
    // 4. 두 번째 줄부터 데이터 매핑 시작
    return rows.slice(1).map((row, index) => {
      const rawCells = row.split(/[\t,]/);
      const cells = rawCells.map(c => c.trim()); // 데이터는 원본 인덱스 유지를 위해 필터링하지 않음
      
      // 학생 객체 초기화
      const student: any = {
        id: `student-${Date.now()}-${index}`, // 고유 ID 자동 생성
        // 문신 새기기
        customLabel1: skill1Info.text,
        customLabel2: skill2Info.text,
      };

      // 숫자 변환 함수 (빈칸이거나 숫자가 아니면 null 반환)
      const parseNum = (v: string | undefined) => {
        if (!v || v === '') return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      // 1. 기본 정보 & 신체 능력 (기존처럼 키워드로 찾기)
      validHeaders.forEach((headerInfo) => {
        const header = headerInfo.text;
        const value = cells[headerInfo.index];

        // --- [핵심] 문지기 없는 유연한 매칭 로직 ---
        if (header.includes('번호')) student.number = value;
        else if (header.includes('이름')) student.name = value;
        else if (header.includes('성별')) student.gender = value;
        
        // 신체 능력
        else if (header.includes('키') || header.includes('신장')) student.height = parseNum(value);
        else if (header.includes('몸무게') || header.includes('체중')) student.weight = parseNum(value);
        
        // 운동 능력 (학교마다 용어가 달라도 인식)
        else if (header.includes('셔틀런') || header.includes('심폐') || header.includes('지구력') || header.includes('오래달리기')) {
          student.endurance = parseNum(value);
        }
        else if (header.includes('유연성') || header.includes('좌전굴') || header.includes('스트레칭')) {
          student.flexibility = parseNum(value);
        }
        else if (header.includes('50m') || header.includes('달리기') || header.includes('순발력')) {
          student.speed = parseNum(value);
        }
      });

      // 2. [핵심 수정] 배구 스킬(Skill1, Skill2)은 절대 좌표로 값 가져오기
      // 위치가 10번째든 12번째든 상관없이 "메롱"이 적혀있던 그 열의 데이터를 가져옴
      student.skill1 = parseNum(cells[skill1Info.index]);
      student.skill2 = parseNum(cells[skill2Info.index]);
  
      return student;
    });
  };
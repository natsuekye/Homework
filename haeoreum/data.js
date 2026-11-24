const MEMBERS = [
  { id: 'director',  name: '관장',   mono: '관', color: '#DDEFE4', deep: '#2E7D55', aka: ['관장님'] },
  { id: 'librarian', name: '사서',   mono: '사', color: '#FBE0EB', deep: '#C2477F', aka: ['사서 선생님', '사서님'] },
  { id: 's1',        name: '학생 1',      mono: '1',  color: '#E6E4FA', deep: '#5F57C2' },
  { id: 's2',        name: '학생 2',      mono: '2',  color: '#D8F1EA', deep: '#23826E' },
  { id: 's3',        name: '학생 3',      mono: '3',  color: '#FCE7DA', deep: '#B9662F' },
  { id: 's4',        name: '학생 4',      mono: '4',  color: '#E1EBFB', deep: '#4170BE' },
  { id: 's5',        name: '학생 5',      mono: '5',  color: '#F1F0D4', deep: '#7D782A' },
];

MEMBERS.forEach(m => { m.label = m.name; m.custom = false; });

function memberById(id) {
  return MEMBERS.find(m => m.id === id) || null;
}

function memberByLabel(label) {
  const flat = v => String(v).split(' ').join('').toLowerCase();
  const key = flat(label);
  return MEMBERS.find(m =>
    flat(m.label) === key || flat(m.name) === key || m.id === key ||
    (m.aka || []).some(a => flat(a) === key)
  ) || null;
}

const TASKS_DEFAULT = {
  am: [
    { id: 'a1', title: '불 켜고 창문 열기', days: null, steps: ['출입문 옆 스위치로 전체 조명 켜기', '창문 두 곳을 10분 정도 열어 환기', '난방기 온도 24도 확인'] },
    { id: 'a2', title: '반납함 비우기', days: null, steps: ['무인 반납함 열쇠는 데스크 첫째 서랍', '꺼낸 책은 반납 PC에서 바코드 찍기', '예약 도서는 예약 칸으로 따로'] },
    { id: 'a7', title: '주말 반납 도서 한 번 더 확인', days: [1], steps: ['월요일은 반납함이 꽉 차 있어요', '두 번에 나눠서 꺼내기'] },
    { id: 'a3', title: '반납 도서 제자리에 꽂기', days: null, steps: ['청구기호 앞자리(분류번호)대로 먼저 나누기', '서가 왼쪽 위에서 오른쪽 아래 순서로', '헷갈리면 라벨 사진을 찍어 사서 선생님께'] },
    { id: 'a4', title: '열람석 정돈하기', days: null, steps: ['의자를 책상 안으로 밀어 넣기', '책상 위 지우개 가루 치우기', '두고 간 물건은 분실물 바구니에'] },
    { id: 'a5', title: '신착 도서 코너 꾸미기', days: null, steps: ['이번 주 들어온 책을 표지가 보이게', '어린이 신간은 낮은 칸에'] },
    { id: 'a6', title: '대출 PC·프린터 켜기', days: null, steps: ['PC 전원 켜고 도서관리 프로그램 로그인', '프린터 용지 남은 양 확인'] },
  ],
  pm: [
    { id: 'p1', title: '서가 정리', days: null, steps: ['앞사람이 멈춘 서가 번호부터 이어서', '거꾸로 꽂힌 책, 튀어나온 책 바로잡기', '끝낸 서가 번호를 메모에 남기기'] },
    { id: 'p2', title: '예약 도서 연락하기', days: null, steps: ['예약 칸에 있는 책 확인', '대출자에게 도착 문자 보내기', '보낸 날짜를 띠지에 적기'] },
    { id: 'p7', title: '독서 프로그램 준비물 챙기기', days: [3], steps: ['수요일 4시 프로그램', '색연필·활동지 인원수만큼'] },
    { id: 'p3', title: '어린이 코너 정리', days: null, steps: ['그림책은 표지 색이 아니라 라벨 순서대로', '방석과 인형 제자리'] },
    { id: 'p4', title: '오늘 이용자 수 적기', days: null, steps: ['출입 카운터 숫자를 이용 대장에 기록', '대출·반납 건수도 함께'] },
    { id: 'p8', title: '이번 주 이용 통계 정리', days: [5], steps: ['요일별 이용자 수 합계', '관장님 메일로 보내기'] },
    { id: 'p5', title: '쓰레기통 비우기', days: null, steps: ['분리수거함은 금요일에만 내놓기'] },
    { id: 'p6', title: '창문·불·PC 끄고 문단속', days: null, steps: ['창문 잠금 확인', 'PC 끄고 프린터 끄기', '조명 끄고 출입문 잠그기'] },
  ],
};

function seedSchedules(today) {
  const y = today.getFullYear(), mo = today.getMonth();
  const firstOf = wd => {
    const d = new Date(y, mo, 1);
    while (d.getDay() !== wd) d.setDate(d.getDate() + 1);
    return d;
  };
  const rows = [
    ['s1', 1, '10:00', '13:00'], ['s1', 3, '10:00', '13:00'],
    ['s2', 2, '13:00', '17:00'], ['s2', 4, '13:00', '17:00'],
    ['s3', 1, '14:00', '18:00'], ['s3', 5, '14:00', '18:00'],
    ['s4', 3, '14:00', '18:00'], ['s4', 4, '14:00', '18:00'],
    ['s5', 2, '10:00', '13:00'], ['s5', 4, '10:00', '13:00'],
  ];
  const list = rows.map(([member, wd, start, end], i) => ({
    id: 'ex' + i, member, kind: 'work', date: ymd(firstOf(wd)),
    start, end, weekly: true, memo: '', ex: true,
  }));
  const meet = new Date(y, mo, 27);
  while (closedInfo(ymd(meet))) meet.setDate(meet.getDate() - 1);
  list.push({ id: 'ex20', member: 'librarian', kind: 'etc', date: ymd(meet),
    start: '15:00', end: '16:00', weekly: false, memo: '도서 구입 회의', ex: true });
  return list;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
function daysLabel(days) {
  if (!days || !days.length) return '매일';
  return WEEK_ORDER.filter(d => days.includes(d)).map(d => WEEK_KO[d]).join('·');
}
function onDay(t, wd) { return !t.days || !t.days.length || t.days.includes(wd); }

const CLOSED_WEEKDAYS = [0, 6];
const OPEN_DAYS = WEEK_ORDER.filter(d => !CLOSED_WEEKDAYS.includes(d));
const HOLIDAYS = {
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일 (삼일절)',
  '2026-05-01': '노동절',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일 (부처님오신날)',
  '2026-06-03': '전국동시지방선거',
  '2026-06-06': '현충일',
  '2026-07-17': '제헌절',
  '2026-08-15': '광복절', '2026-08-17': '대체공휴일 (광복절)',
  '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일 (개천절)',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  '2027-01-01': '신정',
  '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체공휴일 (설날)',
  '2027-03-01': '삼일절',
  '2027-05-01': '노동절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-07-17': '제헌절',
  '2027-08-15': '광복절', '2027-08-16': '대체공휴일 (광복절)',
  '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절', '2027-10-04': '대체공휴일 (개천절)',
  '2027-10-09': '한글날', '2027-10-11': '대체공휴일 (한글날)',
  '2027-12-25': '성탄절', '2027-12-27': '대체공휴일 (성탄절)',
};

function closedInfo(dateStr) {
  const holiday = HOLIDAYS[dateStr] || null;
  const wd = parseYmd(dateStr).getDay();
  if (!holiday && !CLOSED_WEEKDAYS.includes(wd)) return null;
  return { holiday, label: holiday || `${WEEK_KO[wd]}요일` };
}

function ymd(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function hm(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
function koDate(d) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_KO[d.getDay()]}요일`;
}

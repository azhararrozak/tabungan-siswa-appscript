/**
 * Google Apps Script Backend for Student Savings Management
 * Deploy this as a Web App with "Execute as: Me" and "Who has access: Anyone"
 */

const SPREADSHEET_ID = '1oPBmn5YoM-sNJpzX1chHGZFCbzJaYtm-SH_jbHoKrfo';

function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Initialize headers if new sheet
    if (name === 'students') {
      sheet.appendRow(['id', 'nis', 'name', 'class', 'parent_name', 'phone', 'photo_url', 'status', 'created_at']);
    } else if (name === 'accounts') {
      sheet.appendRow(['id', 'student_id', 'account_number', 'initial_balance', 'current_balance', 'created_at']);
    } else if (name === 'transactions') {
      sheet.appendRow(['id', 'account_id', 'student_id', 'type', 'amount', 'method', 'note', 'status', 'date', 'created_by']);
    }
  }
  return sheet;
}

function doGet(e) {
  const action = e.parameter.action;
  let result;

  try {
    switch (action) {
      case 'getStudents':
        result = getStudents();
        break;
      case 'getStudent':
        result = getStudent(e.parameter.id);
        break;
      case 'getTransactions':
        result = getTransactions();
        break;
      case 'getBalance':
        result = getBalance(e.parameter.student_id);
        break;
      case 'getDashboardStats':
        result = getDashboardStats();
        break;
      default:
        return createResponse({ success: false, message: 'Invalid action' });
    }
    return createResponse({ success: true, data: result });
  } catch (error) {
    return createResponse({ success: false, message: error.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;

    switch (action) {
      case 'login':
        result = login(data);
        break;
      case 'createStudent':
        result = createStudent(data);
        break;
      case 'batchCreateStudents':
        result = batchCreateStudents(data);
        break;
      case 'updateStudent':
        result = updateStudent(data);
        break;
      case 'deposit':
        result = createTransaction(data, 'deposit');
        break;
      case 'withdraw':
        result = createTransaction(data, 'withdraw');
        break;
      case 'approveTransaction':
        result = approveTransaction(data.id);
        break;
      case 'rejectTransaction':
        result = rejectTransaction(data.id);
        break;
      default:
        return createResponse({ success: false, message: 'Invalid action' });
    }
    return createResponse({ success: true, data: result });
  } catch (error) {
    return createResponse({ success: false, message: error.toString() });
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Logic Functions ---

function login(data) {
  const { username, password } = data;
  
  if (!username || !password) throw new Error('Username dan password harus diisi');
  
  // Admin Login
  if (username === 'admin' && password === 'admin123') {
    return {
      user: {
        id: 'ADMIN',
        username: 'admin',
        name: 'Administrator',
        role: 'admin'
      },
      token: 'admin-token-' + Date.now()
    };
  }
  
  // Student Login
  const students = getStudents();
  const student = students.find(s => String(s.nis) === String(username));
  
  if (student && String(password) === String(student.nis)) { // Simple: password is NIS
    return {
      user: {
        id: student.id,
        username: student.nis,
        name: student.name,
        role: 'student',
        student_id: student.id
      },
      token: 'student-token-' + student.id + '-' + Date.now()
    };
  }
  
  throw new Error('Username atau password salah');
}

function getStudents() {
  const sheet = getSheet('students');
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) return [];
  
  // Remove headers
  data.shift();
  
  // Hardcoded keys to ensure robustness against header changes/errors in Sheet
  const keys = ['id', 'nis', 'name', 'class', 'parent_name', 'phone', 'photo_url', 'status', 'created_at'];
  
  return data.map(row => {
    const obj = {};
    keys.forEach((k, i) => {
      if (i < row.length) {
        obj[k] = row[i];
      }
    });
    return obj;
  });
}

function getStudent(id) {
  const students = getStudents();
  return students.find(s => s.id === id);
}

function createStudent(data) {
  const studentsSheet = getSheet('students');
  const studentId = 'STU' + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMddHHmmss");
  const date = new Date().toISOString();
  
  const nis = String(data.nis || data.NIS || '').trim();
  const name = String(data.name || data.Name || '').trim();
  const className = String(data.class || data.Class || '').trim();
  const parentName = String(data.parent_name || data.ParentName || '').trim();
  const phone = String(data.phone || data.Phone || '').trim();
  const photoUrl = String(data.photo_url || data.PhotoUrl || '').trim();
  const status = String(data.status || data.Status || 'active').trim();

  if (!nis || !name) {
    throw new Error('NIS dan Nama siswa wajib diisi');
  }

  // Check if NIS already exists
  const existingStudents = getStudents();
  if (existingStudents.some(s => String(s.nis) === nis)) {
    throw new Error('Siswa dengan NIS ' + nis + ' sudah terdaftar');
  }

  studentsSheet.appendRow([
    studentId,
    nis,
    name,
    className,
    parentName,
    phone,
    photoUrl,
    status,
    date
  ]);

  // Create corresponding account for the student in accounts sheet
  const accountsSheet = getSheet('accounts');
  const accountId = 'ACC' + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMddHHmmss");
  const accountNumber = 'ACC' + nis;
  
  accountsSheet.appendRow([
    accountId,
    studentId,
    accountNumber,
    0, // initial_balance
    0, // current_balance
    date
  ]);

  SpreadsheetApp.flush();

  return {
    id: studentId,
    nis: nis,
    name: name,
    class: className,
    parent_name: parentName,
    phone: phone,
    photo_url: photoUrl,
    status: status,
    balance: 0,
    created_at: date
  };
}

function batchCreateStudents(data) {
  const studentsList = data.students || [];
  if (!Array.isArray(studentsList) || studentsList.length === 0) {
    throw new Error('Data siswa untuk dikirim tidak boleh kosong');
  }

  const existingStudents = getStudents();
  const existingNisMap = new Set(existingStudents.map(s => String(s.nis).trim()));

  // Validate all before insertion
  studentsList.forEach((item, index) => {
    const nis = String(item.nis || '').trim();
    const name = String(item.name || '').trim();
    const className = String(item.class || '').trim();

    if (!nis || !name || !className) {
      throw new Error('Siswa ke-' + (index + 1) + ' tidak lengkap (NIS, Nama, dan Kelas wajib diisi)');
    }

    if (existingNisMap.has(nis)) {
      throw new Error('Siswa dengan NIS ' + nis + ' sudah terdaftar di database');
    }
  });

  const studentsSheet = getSheet('students');
  const accountsSheet = getSheet('accounts');
  const now = new Date();
  const dateStr = now.toISOString();

  const createdStudents = [];
  const studentRows = [];
  const accountRows = [];

  studentsList.forEach((item, index) => {
    const timeStamp = Utilities.formatDate(new Date(now.getTime() + index), "GMT+7", "yyyyMMddHHmmssSSS");
    const studentId = 'STU' + timeStamp;
    const accountId = 'ACC' + timeStamp;

    const nis = String(item.nis || '').trim();
    const name = String(item.name || '').trim();
    const className = String(item.class || '').trim();
    const parentName = String(item.parent_name || '').trim();
    const phone = String(item.phone || '').trim();
    const photoUrl = String(item.photo_url || '').trim();
    const status = String(item.status || 'active').trim();
    const accountNumber = 'ACC' + nis;

    studentRows.push([
      studentId,
      nis,
      name,
      className,
      parentName,
      phone,
      photoUrl,
      status,
      dateStr
    ]);

    accountRows.push([
      accountId,
      studentId,
      accountNumber,
      0, // initial_balance
      0, // current_balance
      dateStr
    ]);

    createdStudents.push({
      id: studentId,
      nis: nis,
      name: name,
      class: className,
      parent_name: parentName,
      phone: phone,
      photo_url: photoUrl,
      status: status,
      balance: 0,
      created_at: dateStr
    });
  });

  if (studentRows.length > 0) {
    const lastStudentRow = studentsSheet.getLastRow();
    studentsSheet.getRange(lastStudentRow + 1, 1, studentRows.length, studentRows[0].length).setValues(studentRows);

    const lastAccountRow = accountsSheet.getLastRow();
    accountsSheet.getRange(lastAccountRow + 1, 1, accountRows.length, accountRows[0].length).setValues(accountRows);

    SpreadsheetApp.flush();
  }

  return createdStudents;
}

function updateStudent(data) {
  const studentsSheet = getSheet('students');
  const studentData = studentsSheet.getDataRange().getValues();
  studentData.shift(); // remove headers
  
  const studentId = data.id || data.Id;
  if (!studentId) throw new Error('ID Siswa diperlukan');

  const studentIndex = studentData.findIndex(row => row[0] === studentId);
  if (studentIndex === -1) throw new Error('Siswa tidak ditemukan');

  const rowIndex = studentIndex + 2;
  const currentRow = studentData[studentIndex];

  const nis = data.nis !== undefined ? String(data.nis).trim() : currentRow[1];
  const name = data.name !== undefined ? String(data.name).trim() : currentRow[2];
  const className = data.class !== undefined ? String(data.class).trim() : currentRow[3];
  const parentName = data.parent_name !== undefined ? String(data.parent_name).trim() : currentRow[4];
  const phone = data.phone !== undefined ? String(data.phone).trim() : currentRow[5];
  const photoUrl = data.photo_url !== undefined ? String(data.photo_url).trim() : currentRow[6];
  const status = data.status !== undefined ? String(data.status).trim() : currentRow[7];

  studentsSheet.getRange(rowIndex, 2, 1, 7).setValues([[
    nis,
    name,
    className,
    parentName,
    phone,
    photoUrl,
    status
  ]]);

  SpreadsheetApp.flush();

  return {
    id: studentId,
    nis: nis,
    name: name,
    class: className,
    parent_name: parentName,
    phone: phone,
    photo_url: photoUrl,
    status: status,
    created_at: currentRow[8]
  };
}

function getTransactions() {
  const sheet = getSheet('transactions');
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) return [];
  
  // Remove headers
  data.shift();
  
  // Hardcoded keys to match the appendRow order in createTransaction
  const keys = ['id', 'account_id', 'student_id', 'type', 'amount', 'method', 'note', 'status', 'date', 'created_by'];
  
  return data.map(row => {
    const obj = {};
    keys.forEach((k, i) => {
      if (i < row.length) obj[k] = row[i];
    });
    return obj;
  });
}

function getBalance(studentId) {
  const accountSheet = getSheet('accounts');
  const data = accountSheet.getDataRange().getValues();
  data.shift(); // remove headers
  const account = data.find(row => row[1] === studentId);
  return { balance: account ? account[4] : 0 };
}

function createTransaction(data, type) {
  const studentId = data.student_id || data.StudentId;
  const amount = Number(data.amount || data.Amount);
  
  let status = 'pending';
  const inputStatus = data.status || data.Status;
  if (inputStatus && String(inputStatus).toLowerCase() === 'completed') {
    status = 'completed';
  }
  
  // Get account
  const accountSheet = getSheet('accounts');
  const accData = accountSheet.getDataRange().getValues();
  accData.shift();
  const accIndex = accData.findIndex(row => row[1] === studentId);
  
  if (accIndex === -1) throw new Error('Akun siswa tidak ditemukan. Pastikan siswa telah terdaftar.');
  
  const accountRow = accData[accIndex];
  const accId = accountRow[0];
  let currentBalance = Number(accountRow[4]);

  if (type === 'withdraw' && currentBalance < amount) {
    throw new Error('Saldo tidak mencukupi untuk penarikan.');
  }

  if (status === 'completed') {
    if (type === 'deposit') currentBalance += amount;
    else currentBalance -= amount;
    accountSheet.getRange(accIndex + 2, 5).setValue(currentBalance);
  }

  // Record transaction
  const transSheet = getSheet('transactions');
  const transId = 'TRX' + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMddHHmmss");
  const date = new Date().toISOString();
  
  transSheet.appendRow([
    transId,
    accId,
    studentId,
    type,
    amount,
    data.method || data.Method || 'cash',
    data.note || data.Note || '',
    status,
    date,
    data.created_by || data.CreatedBy || 'admin'
  ]);

  SpreadsheetApp.flush();
  return { id: transId, balance: currentBalance, status: status };
}

function approveTransaction(id) {
  const transSheet = getSheet('transactions');
  const transData = transSheet.getDataRange().getValues();
  transData.shift();
  const transIndex = transData.findIndex(row => row[0] === id);
  
  if (transIndex === -1) throw new Error('Transaksi tidak ditemukan');
  
  const transRow = transData[transIndex];
  const currentStatus = String(transRow[7]).toLowerCase();
  
  if (currentStatus === 'completed') throw new Error('Transaksi sudah disetujui sebelumnya');
  if (currentStatus === 'rejected') throw new Error('Transaksi yang ditolak tidak dapat disetujui');
  
  const studentId = transRow[2];
  const type = transRow[3];
  const amount = Number(transRow[4]);
  
  // Update account balance
  const accountSheet = getSheet('accounts');
  const accData = accountSheet.getDataRange().getValues();
  accData.shift();
  const accIndex = accData.findIndex(row => row[1] === studentId);
  
  if (accIndex === -1) throw new Error('Akun siswa tidak ditemukan');
  
  let currentBalance = Number(accData[accIndex][4]);
  
  if (type === 'deposit') {
    currentBalance += amount;
  } else {
    if (currentBalance < amount) throw new Error('Saldo tidak mencukupi');
    currentBalance -= amount;
  }
  
  accountSheet.getRange(accIndex + 2, 5).setValue(currentBalance);
  
  // Update transaction status
  transSheet.getRange(transIndex + 2, 8).setValue('completed');
  
  SpreadsheetApp.flush();
  return { id, balance: currentBalance, status: 'completed' };
}

function rejectTransaction(id) {
  const transSheet = getSheet('transactions');
  const transData = transSheet.getDataRange().getValues();
  transData.shift();
  const transIndex = transData.findIndex(row => row[0] === id);
  
  if (transIndex === -1) throw new Error('Transaksi tidak ditemukan');
  
  const transRow = transData[transIndex];
  const currentStatus = String(transRow[7]).toLowerCase();
  
  if (currentStatus === 'completed') throw new Error('Tidak dapat menolak transaksi yang sudah disetujui');
  if (currentStatus === 'rejected') throw new Error('Transaksi sudah ditolak sebelumnya');
  
  transSheet.getRange(transIndex + 2, 8).setValue('rejected');
  
  SpreadsheetApp.flush();
  return { id, status: 'rejected' };
}

function getDashboardStats() {
  const students = getStudents();
  const accounts = getSheet('accounts').getDataRange().getValues();
  accounts.shift();
  
  const totalSavings = accounts.reduce((sum, row) => sum + Number(row[4] || 0), 0);
  
  const transactions = getTransactions();
  const today = new Date().toISOString().split('T')[0];
  const todayDeposits = transactions
    .filter(t => t.type === 'deposit' && t.date && t.date.startsWith(today))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return {
    totalStudents: students.length,
    totalSavings: totalSavings,
    todayDeposits: todayDeposits
  };
}

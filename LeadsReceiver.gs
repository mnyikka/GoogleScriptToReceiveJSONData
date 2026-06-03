const key = "0123456789012345";

/* Generic upload script */
function doGet(e)
{
   return ContentService.createTextOutput("Service is running OK from Google Cloud!");
}

/* On post */
function doPost(e)
{
    var array1 = {};
    try
    {
          //var data = DecryptDataUsingPrefixedIV((""+e.parameters.data), key);
          var structure = JSON.parse(e.parameters.data);
          if(structure.intent == "scrapeuploads")
          {
              array1 = doScrapeUploads(structure);
          }
          else
          if(structure.intent == "scrapedownloads")
          {
              array1 = doScrapeDownloads(structure);
          }
          else
          {
            throw ("Unknown intent");
          }
    }
    catch(e)
    {
        array1["success"] = false;
        array1["error"] = getStackTrace(e);
        array1["message"] = JSON.stringify(e);
    }
   return ContentService.createTextOutput(JSON.stringify(array1));
}


//DATEUTILTIES.GS
function getDateStringAsUTCTimestamp(DateStringISO, DefaultValue) 
{
    try
    {
      DateStringISO = DateStringISO.replace("Z","");
      let myDate = new Date(DateStringISO);
      return myDate.getTime(); 
    }
    catch (e)
    {
      
    }
    return DefaultValue;
}


//ERRORHANDLING.GS
const getStackTrace = function(error) 
{
  try
  {
    let s = `Error: ${error.message}\n`;
    error.stack
        .split('\n')
        .forEach((token) => s += `\t${token.trim()}\n`);      
    return s;
  }
  catch(e)
  {
     try
     { 
        return error.message; 
     }catch (em2) 
     {
      
     }
  }
  return (""+error);
}


//SCRAPEDOWNLOADS.GS
/* It simply handles downloading from a named sheet */
function doScrapeDownloads(structure) 
{
    try
    {
       var sourceSheet = structure.sourceSheet;
       if(sourceSheet == undefined)
          throw ("sourceSheet not set?");

       var spreadSheet1 = getGoogleSheetByName(sourceSheet);
       if(spreadSheet1 == null)
       {
          throw ("Google sheet named "+sourceSheet+" does not exist");
       }
       
       var startFrom =  parseInt(""+structure.startFrom);
       var limit =  parseInt(""+structure.limit);
       var sortAscending = true;
       
       var MINDATE_VALUE = 0;
       var MAXDATE_VALUE = 0;

        //Sort condition
        if(structure.sortCondition != undefined)
        {
            if(structure.sortCondition.SystemCreateDate != undefined)
            {
                sortAscending =  (""+structure.sortCondition.SystemCreateDate.toUpperCase()) == "DESC";
            }
        }

        //Filter condition
        if(structure.filtercondition != undefined)
        {
            let filters = JSON.parse(structure.filtercondition);
            MINDATE_VALUE = parseInt(""+filters.FROM);
            MAXDATE_VALUE = parseInt(""+filters.TO);
            if(isNaN(MINDATE_VALUE))
              throw ("MINDATE_VALUE must be a number?");
            
            if(isNaN(MAXDATE_VALUE))
              throw ("MAXDATE_VALUE must be a number?");
        }

        //Download the data now! Get as array?
        var allRows = GetUsedRangeAsArray(spreadSheet1);
        var totalCount = (allRows.length - 1);
        //Sometimes we dont have any rows,
        if(allRows.length <= 1)
        {
            return getEndOfSearchReachedArray();
        }
        
          

          var filteredRows = allRows;
          //Determine the filter and sort column
          let filtercolumn = structure.filtercolumn;
          if(filtercolumn == undefined)
          {
             throw ("filtercolumn must be set it cannot be undefined?");
          }

          let filterColumnIndex = -1;
          let columns = {}; //keeps a reference to the actual data columns we are using?
          
          for(var index=0; index<allRows.length; index++)
          {
              let headerRow = allRows[index];
              for(var col=0; col<headerRow.length; col++)
              {
                 let cellValue = getValueFromSpreadSheetCell(headerRow[col]);
                 if(cellValue.length > 0)
                 {
                    columns[cellValue] = col;
                 }
                 if(cellValue.toUpperCase() == filtercolumn.toUpperCase())
                 {
                    filterColumnIndex = col;
                 }
              }
              break;
          }

          if(filterColumnIndex == -1)
          {
             throw ("Cannot find the filter column? "+filtercolumn);
          }

          /* If filters NOT applied we know where to start */
          var startIndex = 0;

          filteredRows = new Array();
          //Filter the data?
          if(MINDATE_VALUE != 0 && MAXDATE_VALUE != 0)
          {
              /* Filter from row 1 where the values start */
              for(var index=1; index<allRows.length; index++)
              {
                var testValue = allRows[index][filterColumnIndex];
                testValue = getValueFromSpreadSheetCell(testValue);
                if(testValue.length > 0)
                {
                    var myDate = new Date(testValue);
                    if(myDate.getTime() >= MINDATE_VALUE && myDate.getTime() <= MAXDATE_VALUE)
                    {
                      filteredRows.push(allRows[index]); 
                    } 
                }  
              }
              startIndex = 0;
              totalCount = filteredRows.length;
          }
          else
          {
              for(var index=1; index<allRows.length; index++)
              {
                 filteredRows.push(allRows[index]); 
              }
              totalCount = filteredRows.length;
              startIndex = 0;
          }


          //Filter the data?
          filteredRows.sort(function(a,b)
          {
              let aDateString = getValueFromSpreadSheetCell(a[filterColumnIndex]);
              let bDateString = getValueFromSpreadSheetCell(b[filterColumnIndex]);

              let aDateValue = getDateStringAsUTCTimestamp(aDateString, 0);
              let bDateValue = getDateStringAsUTCTimestamp(bDateString, 0);

              if(sortAscending == true)
              {
                if(aDateValue > bDateValue)
                    return 1;
                if(bDateValue < aDateValue)
                    return -1;
                 return 0;
              }
              else
              {
                if(aDateValue > bDateValue)
                    return -1;
                if(bDateValue < aDateValue)
                    return 1;
                return 0;
              }
          });
          
       var rows = Array();
       var columnsString = Object.keys(columns);
       var columnIndexes = Object.values(columns);
       let nextStartFrom = 0;
       let countedRows = startIndex + startFrom;
       let remainingCount = -1;
       let realdownloadCount = 0;

       nextStartFrom = filteredRows.length;

       for(var ix = (startIndex + startFrom); ix<filteredRows.length; ix++)
       {
          var theRow = Array();
          var sourceRow = filteredRows[ix];

          for(var col=0; col<columnIndexes.length; col++)
          {
              theRow.push(getValueFromSpreadSheetCell(sourceRow[columnIndexes[col]]));   
          }
          countedRows = countedRows + 1;
          rows.push(theRow);
          realdownloadCount = (ix+1);

          if(rows.length >= limit)
          {
             nextStartFrom = ((ix+1) + 1);
             remainingCount = ((filteredRows.length - ix)); 
             break;
          }
       }

       if(remainingCount == -1)
       {
          remainingCount = Math.max(0 , ((filteredRows.length - (countedRows)) - 1));
       }
       
        /* Return them a success message if all went well */
        var dict = {};
        dict["success"] = true;
        dict["nextStartFrom"] = nextStartFrom;
        dict["rowCount"] = rows.length;
        dict["totalCount"] = totalCount;
        dict["remainingCount"] = remainingCount;
        var data = {};
        data['rows'] = rows;
        data['columns'] = columnsString;
        dict["data"] = data;
        dict["downloadedCount"] = realdownloadCount;
        dict["error"] = null;
        return dict;
    }
    catch(e)
    {
       var dict = {};
       dict["success"] = false;
       //dict["error"] = "Unknown error";
       dict["error"] = getStackTrace(e);
       return dict;
    }
}


/* Returns the end of search reached array */
function getEndOfSearchReachedArray()
{
   let dict = {};
   dict["success"] = true;
   dict["nextStartFrom"] = 0;
   dict["rowCount"] = 0;
   dict["totalCount"] = 0;
   dict["remainingCount"] = 0;
   dict["data"] = {"rows": new Array(), 
   "columns": new Array() };
   dict["downloadedCount"] = 0;
   return dict;
}


//SCRAPEUPLOADS.GS
/* It simply handles uploading from the server for lookup purposes */
function doScrapeUploads(structure) 
{
     // Get the script-level lock
    var lock = LockService.getScriptLock();
    try
    {
       
        // Wait up to 10000 milliseconds for other processes to finish and acquire lock
        lock.waitLock(10000); 
       
       var destinationSheet = structure.destinationSheet;
       if(destinationSheet == undefined)
          throw ("destinationSheet not set?");

       var spreadSheet1 = createNewSheetIfNotExist(destinationSheet);
       spreadSheet1.activate();
       if(spreadSheet1 == null)
          throw ("Unable to create sheet named? "+destinationSheet);
       var columns = structure.columns;
       if(columns == undefined)
          throw ("Columns array not set?");
       
       var dictColumns = createColumnsDictionary(columns, spreadSheet1, 200);
       var primarykey = structure.primaryKey;
       if(primarykey == undefined)
          throw ("primaryKey column not set?");
       
       var dataRows = structure.dataRows;
       if(dataRows == undefined)
          throw ("dataRows not defined in your dataset?");
       
       var totalNewRows = 0;
       var totalDuplicates = 0;

       for(var row=0; row<dataRows.length; row++)
       {
          var currentRow = dataRows[row];
          if( insertDataRowAtSpreadsheet(spreadSheet1, currentRow, primarykey, dictColumns, structure.doNotUpdateExisting) == true )
          {
             totalNewRows = totalNewRows + 1;
          }
          else
          {
             totalDuplicates = totalDuplicates + 1;
          }
       }

      SpreadsheetApp.flush(); 
      /* Return them a success message if all went well */
      var dict = {};
      dict["success"] = true;
      dict["totalNewRows"] = totalNewRows;
      dict["totalDuplicates"] = totalDuplicates;
      dict["error"] = null;
      return dict;
    }
    catch(e)
    {
       var dict = {};
       dict["success"] = false;
       dict["error"] = getStackTrace(e);
       dict["message"] = JSON.stringify(e);
       return dict;
    }
    finally
    {
        lock.releaseLock();
    }
}


//SPREADSHEETUTILITIES.GS
/* Returns the used range as an array */
function GetUsedRangeAsArray(Sheet) 
{
    var array_ = Sheet.getDataRange().getValues();
    return array_;
}


/* Ensures we have a spreadSheet named ?*/
function getGoogleSheetByName(sheetName)
{
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    for (var i = 0; i < sheets.length ; i++ ) 
    {
        var sheet = sheets[i];
        if(sheet.getName().toLowerCase() == sheetName.toLowerCase())
        {
           return sheet;
        }
    }
    return null;
}


/* Gets a value returned from the values Array as a String*/
function getValueFromSpreadSheetCell(objectValue)
{
    if( objectValue == null || objectValue == undefined )
        return "";

    if(typeof objectValue.toISOString === 'function')
    {
        let DateString = objectValue.toISOString();
        return (""+DateString).replace("Z", "");
    }

    return (""+objectValue);
}


/* Ensures we have a spreadSheet named ?*/
function createNewSheetIfNotExist(sheetName)
{
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    for (var i = 0; i < sheets.length ; i++ ) 
    {
        var sheet = sheets[i];
        if(sheet.getName().toLowerCase() == sheetName.toLowerCase())
        {
           return sheet;
        }
    }
    // The sheetName parameter has to be passed to the function when it's called
    let activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let newSheet = activeSpreadsheet.insertSheet();
    newSheet.setName(sheetName); // We sheet will be called as the string of the parameter
    return newSheet;
}


/* 
Creates a columns dictionary. From the columnsArray, 
we make sure that each string in that array has a columnLetter on the sheet 
*/
function createColumnsDictionary(columnsArray,useSheet,columnWidth)
{
   let dict = {};
   //Load everything first?
   for(var ix=0; ix<columnsArray.length; ix++)
   {
      let ColName = columnsArray[ix];
      dict[ColName] = null;
      //Check if we have that columnName
      //SpreadsheetApp.getActiveSheet().getLastColumn
      let maxCols = useSheet.getLastColumn();
      let lastEmptyColIndex = -1;
      for(var ip=0; ip<maxCols; ip++)
      {
          var letter = GetColumnAsString(ip+1);
          var theValue = (""+useSheet.getRange(letter + "1").getValue()).trim();
          if(theValue.toLowerCase() == ColName.toLowerCase())
          {
              useSheet.getRange(letter + "1").setValue(ColName);
              useSheet.getRange(letter + "1").setFontWeight("bold");
              if(false)
              {
                  useSheet.setColumnWidth(ip+1, columnWidth);
              }
              dict[ColName] = letter;
              break;
          }
          if(lastEmptyColIndex == -1)
          {
            if(theValue.length == 0)
            {
               lastEmptyColIndex = ip+1;
            }
          }
      }
      if(dict[ColName] == null)
      {
         var letter = GetColumnAsString(maxCols+1);
         if(lastEmptyColIndex != -1)
         {
            letter = GetColumnAsString(lastEmptyColIndex);
         }
         useSheet.getRange(letter + "1").setValue(ColName);
         useSheet.getRange(letter + "1").setFontWeight("bold");
         if(columnWidth != undefined)
         {
            useSheet.setColumnWidth(maxCols+1, columnWidth);
         }
         dict[ColName] = letter;
      }
   }
   return dict;  
}


/** Inserts a dataRow at the spreadSheet */
function insertDataRowAtSpreadsheet(spreadSheet1, currentRow, primarykey, dictColumns, doNotUpdateExisting)
{
  var spreadSheet6 = spreadSheet1;
  let maxRow = spreadSheet6.getLastRow();
  let primaryKeyLetter = dictColumns[primarykey];
  let colArray = Object.keys(dictColumns);
  if(currentRow.length != colArray.length)
  {
     throw ("Expected row array to be the same as column array length? Found "+currentRow.length+" versus "+colArray.length);
  }

  let priKeyIndex = colArray.indexOf(primarykey);
  let priKeyValue = currentRow[priKeyIndex];

  if(primaryKeyLetter == undefined)
  {
     throw ("Cannot find primary key column "+primarykey+" in the column dictionary?");
  }

  let useRowIndex = 2;
  if(maxRow >= useRowIndex)
  {
     useRowIndex = maxRow + 1;
  } 
  
  var isnew = true;
  for(var ix=2; ix<=maxRow; ix++)
  {
     var compareValue = spreadSheet6.getRange(primaryKeyLetter + ix).getValue();
     if(compareValue == priKeyValue)
     {
        isnew = false;
        useRowIndex = ix;
        break;
     }  
  }

  if(doNotUpdateExisting === true)
  {
     if(isnew == false)
        return isnew;
  }

  /* Now set the value */
  for(var cols=0; cols<colArray.length; cols++)
  {
     let destinationAddress = dictColumns[colArray[cols]] + useRowIndex;
     let destinationValue = currentRow[cols];
     spreadSheet6.getRange(destinationAddress).setValue(destinationValue);
  }
  
  return isnew;
}


//Converts a column to a letter
function GetColumnAsString(column)
{
  var temp, letter = '';
  while (column > 0)
  {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/* Converts a letter to a column */
function GetColumnAsNumber(letter)
{
  var column = 0, length = letter.length;
  for (var i = 0; i < length; i++)
  {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}

/*Offsets a column letter */
function OffSetColumnLetter(column, offsetcount)
{
   var TheIndex = GetColumnAsNumber(column);
   return GetColumnAsString(TheIndex + offsetcount);
}
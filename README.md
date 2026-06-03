A simple gs script that would receive JSON data and check for unique rows using 
a primary key column specified.
It may insert or update rows depending on how the JSON object is specified.

Uploading structure JSON:

let structure = {};

structure["columns"] = columns; 
//(One dimensional array of the columns)

structure["intent"] = intent; 
//(intent can be either scrapeuploads or scrapedownloads)

structure["destinationSheet"] = destinationSheet; 
//(The destination sheet name, this will be created if it does not exist, and the columns specified on the first row of the sheet)

structure["dataRows"] = dataRows; 
//data rows, an array, of arrays (0 based indexed arrays). Each element in the inner array index should be the same as the intended column title index in the columns array.

structure["primaryKey"] = primaryKey; 
//A string, primary key column

structure["doNotUpdateExisting"] = doNotUpdateExisting; 
//If set to true, existing rows will not be updated. Only new rows are added.

The gs script can also download JSON data, while specifying the page parameters.

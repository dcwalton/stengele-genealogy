/**
 * A small sample GEDCOM file used as the default dataset.
 * Contains a fictional family tree with four generations of ancestors
 * for the starting person Ivan Petrov (@I1@).
 */
export const SAMPLE_GEDCOM = `0 HEAD
1 SOUR SAMPLE
2 NAME Sample Family Tree
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @SUBM@ SUBM
1 NAME Sample Uploader
0 @I1@ INDI
1 NAME Ivan /Petrov/
2 GIVN Ivan
2 SURN Petrov
1 SEX M
1 BIRT
2 DATE 1 JAN 1980
2 PLAC Moscow, Russia
1 FAMC @F1@
0 @I2@ INDI
1 NAME Maria /Petrova/
2 GIVN Maria
2 SURN Petrova
1 SEX F
1 BIRT
2 DATE 12 MAR 1955
2 PLAC Moscow, Russia
1 FAMS @F1@
1 FAMC @F2@
0 @I3@ INDI
1 NAME Dmitri /Petrov/
2 GIVN Dmitri
2 SURN Petrov
1 SEX M
1 BIRT
2 DATE 3 OCT 1952
2 PLAC Tver, Russia
1 FAMS @F1@
1 FAMC @F3@
0 @I4@ INDI
1 NAME Olga /Volkova/
2 GIVN Olga
2 SURN Volkova
1 SEX F
1 BIRT
2 DATE 20 JUL 1956
2 PLAC Moscow, Russia
1 FAMS @F2@
1 FAMC @F4@
0 @I5@ INDI
1 NAME Sergei /Smirnov/
2 GIVN Sergei
2 SURN Smirnov
1 SEX M
1 BIRT
2 DATE 8 NOV 1950
2 PLAC Kazan, Russia
1 FAMS @F2@
1 FAMC @F5@
0 @I6@ INDI
1 NAME Elena /Orlova/
2 GIVN Elena
2 SURN Orlova
1 SEX F
1 BIRT
2 DATE 14 FEB 1958
2 PLAC Moscow, Russia
1 FAMS @F4@
1 FAMC @F6@
0 @I7@ INDI
1 NAME Nikolai /Volkov/
2 GIVN Nikolai
2 SURN Volkov
1 SEX M
1 BIRT
2 DATE 2 APR 1951
2 PLAC Vladimir, Russia
1 FAMS @F4@
1 FAMC @F7@
0 @I8@ INDI
1 NAME Tatiana /Orlova/
2 GIVN Tatiana
2 SURN Orlova
1 SEX F
1 BIRT
2 DATE 9 SEP 1953
2 PLAC Moscow, Russia
1 FAMS @F5@
1 FAMC @F8@
0 @I9@ INDI
1 NAME Pavel /Orlov/
2 GIVN Pavel
2 SURN Orlov
1 SEX M
1 BIRT
2 DATE 17 MAY 1948
2 PLAC Tver, Russia
1 FAMS @F5@
0 @I10@ INDI
1 NAME Fedor /Sokolov/
2 GIVN Fedor
2 SURN Sokolov
1 SEX M
1 BIRT
2 DATE 11 MAR 1945
2 PLAC Yaroslavl, Russia
1 FAMS @F3@
0 @I11@ INDI
1 NAME Nina /Belova/
2 GIVN Nina
2 SURN Belova
1 SEX F
1 BIRT
2 DATE 27 AUG 1948
2 PLAC Moscow, Russia
1 FAMS @F3@
0 @I12@ INDI
1 NAME Irina /Kuznetsova/
2 GIVN Irina
2 SURN Kuznetsova
1 SEX F
1 BIRT
2 DATE 25 AUG 1952
2 PLAC Moscow, Russia
1 FAMS @F6@
0 @I13@ INDI
1 NAME Viktor /Kuznetsov/
2 GIVN Viktor
2 SURN Kuznetsov
1 SEX M
1 BIRT
2 DATE 6 JUL 1949
2 PLAC Ryazan, Russia
1 FAMS @F6@
0 @I14@ INDI
1 NAME Galina /Morozova/
2 GIVN Galina
2 SURN Morozova
1 SEX F
1 BIRT
2 DATE 19 MAR 1954
2 PLAC Moscow, Russia
1 FAMS @F7@
0 @I15@ INDI
1 NAME Boris /Morozov/
2 GIVN Boris
2 SURN Morozov
1 SEX M
1 BIRT
2 DATE 23 OCT 1951
2 PLAC Tver, Russia
1 FAMS @F7@
0 @I16@ INDI
1 NAME Svetlana /Zaitseva/
2 GIVN Svetlana
2 SURN Zaitseva
1 SEX F
1 BIRT
2 DATE 7 JUN 1957
2 PLAC Moscow, Russia
1 FAMS @F8@
0 @I17@ INDI
1 NAME Andrei /Zaitsev/
2 GIVN Andrei
2 SURN Zaitsev
1 SEX M
1 BIRT
2 DATE 16 NOV 1952
2 PLAC Nizhny Novgorod, Russia
1 FAMS @F8@
0 @F1@ FAM
1 HUSB @I3@
1 WIFE @I2@
1 CHIL @I1@
1 MARR
2 DATE 10 MAY 1978
2 PLAC Moscow, Russia
0 @F2@ FAM
1 HUSB @I5@
1 WIFE @I4@
1 CHIL @I2@
1 MARR
2 DATE 22 SEP 1981
2 PLAC Saint Petersburg, Russia
0 @F3@ FAM
1 HUSB @I10@
1 WIFE @I11@
1 CHIL @I3@
1 MARR
2 DATE 4 JUL 1976
2 PLAC Yaroslavl, Russia
0 @F4@ FAM
1 HUSB @I7@
1 WIFE @I6@
1 CHIL @I4@
1 MARR
2 DATE 15 AUG 1974
2 PLAC Moscow, Russia
0 @F5@ FAM
1 HUSB @I9@
1 WIFE @I8@
1 CHIL @I5@
1 MARR
2 DATE 28 JUN 1972
2 PLAC Tver, Russia
0 @F6@ FAM
1 HUSB @I13@
1 WIFE @I12@
1 CHIL @I6@
1 MARR
2 DATE 9 MAY 1970
2 PLAC Ryazan, Russia
0 @F7@ FAM
1 HUSB @I15@
1 WIFE @I14@
1 CHIL @I7@
1 MARR
2 DATE 2 APR 1968
2 PLAC Tver, Russia
0 @F8@ FAM
1 HUSB @I17@
1 WIFE @I16@
1 CHIL @I8@
1 MARR
2 DATE 19 JAN 1980
2 PLAC Nizhny Novgorod, Russia
0 TRLR
`;

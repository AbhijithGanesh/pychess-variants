# ![Shogun ikon](https://github.com/gbtami/pychess-variants/blob/master/static/icons/shogun.svg) Sógun sakk (Shogun Chess)

![Shogun ábra](https://github.com/gbtami/pychess-variants/blob/master/static/images/CVariantsGuide/ShogunPromotions_HU.png)

A Sógun sakk egy sakkvariáns, amit [*Couch Tomato*](https://github.com/CouchTomato87) 2019-ben tervezett meg. A játék a standard sakk és a sógi (japán sakk) keveréke, az eredeti ötlet pedig az volt, hogy a hibrid bábukat másképp használja, mint más, korábbi sakkváltozatok. A cél a 8x8-as táblaméret megtartása volt, hogy a könnyűtisztek értéke ne csökkenjen, illetve hogy a tábla ne legyen túl zsúfolt az új bábuk miatt (mint pl. az S-sakkban). Az ötlet az volt, hogy az új bábukat a  alapbábuk előléptetésével lehessen játékba hozni. Később a sógiból vagy a crazyhouse variánsból már ismert behozási szabály is a játék részévé vált (a leütött bábuk saját bábuként a táblára visszahelyezhetőkké válnak).

A játék neve eredetileg "Tábornok sakk" (General's Chess) lett volna, de azért lett végül Sógun sakk, mert a bábuk előléptetési és behozási lehetősége eredetileg a sógiból (japán sakk) származik, így megfelelőbb volt a *Sógun* elnevezés használata, ami japánul tábornokot jelent.

## Szabályok

* A kezdőállás ugyanaz, mint a standard sakkban.

* Az utolsó három sor az előléptetési zóna. A királyt és a királynőt leszámítva minden alapbábu előléptethető erre a területre való belépéssel (vagy odahelyezett bábu esetén az onnan továbblépéssel).

* A királynőből, a mozsárágyúból, az érsekből és a tábornokból csak egy-egy darabja lehet egy játékosnak. Ha például már van egy érsekünk a táblán, akkor a futó addig nem léptethető elő érsekké, amíg az előbbi leütésre nem kerül.

* A bábukat visszahelyezni a táblára csak az első 5 sorba lehet, tehát az utolsó három sorba (előléptetési zónába) nem. A gyalogok az első sorba is behozhatók.

* Az első sorba behozott gyalog léphet kettőt azután, hogy elérte a második sort (tehát második lépésben léphet kettőt).

* Egy gyalog nem léptethető elő, ha *en passant* üti le az ellenfél gyalogját.

* Amikor egy előléptetett bábu leütésre kerül, akkor visszaalakul az eredeti figurává és visszahelyezni is csak úgy lehet a táblára. A királynő már "előléptetett" formában kezd, a táblára visszahelyezhető formája a *hercegnő*.

* Behozott bástya nem sáncolhat.


**Időmérés**: A játékban úgynevezett bjójomi (byo-yomi) ("másodperc olvasás") is része az időmérésnek. Amikor egy játékos ideje letelik, akkor következik a bjójomi, azaz onnantól mindig egy fixen meghatározott ideje marad egy-egy lépésre (pl. 30 másodperc). Ha lép, akkor ez az idő újra rendelkezésre áll majd a következő lépésben, ha kifut az időből, akkor elveszíti a játszmát.

## Új bábuk

### Érsek

![Érsek ábra](https://github.com/gbtami/pychess-variants/blob/master/static/images/CVariantsGuide/ArchbishopShogun.png)

Az érsek (angolul: *Archbishop*) a huszár és a futó kombinációja. Az érsek az egyedüli bábu, amely képes egymagában mattot adni.

### Mozsárágyú

![Mozsárágyú ábra](https://github.com/gbtami/pychess-variants/blob/master/static/images/CVariantsGuide/Mortar.png)

A mozsárágyú (angolul: *mortar*) a huszár és a bástya kombinációja.

### Tábornok

![Tábornok ábra](https://github.com/gbtami/pychess-variants/blob/master/static/images/CVariantsGuide/General.png)

A tábornok (angolul: *general*) a huszár és a király kombinációja.

### Kapitány

![Kapitány ábra](https://github.com/gbtami/pychess-variants/blob/master/static/images/CVariantsGuide/Captain.png)

A kapitány (angolul: *captain*) a gyalog előléptetett formája. A király lépés- és ütéslehetőségeivel rendelkezik (egy mező bármely irányba). A többi új bábuval ellentétben a kapitányból lehet egyszerre több is a táblán.

### Hercegnő

![Hercegnő ábra](https://github.com/gbtami/pychess-variants/blob/master/static/images/CVariantsGuide/Duchess.png)

A hercegnő (angolul: *duchess*) a királynő "lefokozott" formája és csak azután kerül a játékba, hogy a királynő leütésre került (amikor is az hercegnővé alakul át). A hercegnő csak átlóban tud lépni egyet. A hercegnő nem léptethető elő királynővé, ha az eredeti királynőnk még a táblán van.

## Stratégia

Kezdő játékosnak oda kell figyelni arra, hogy az előléptetési zóna védve legyen, főleg a 3. és a 6. sor (oldaltól függően), amely a legközelebbi lehetőség az előléptetésre.

A crazyhouse variánsban megszokott taktikák nem feltétlenül működnek itt is. Mivel itt az előléptetési zónába nem lehet visszahelyezni a bábukat, ezért azoknak be kell hatolniuk az ellenfél táborába, amivel aztán az előléptetés is elérhetővé válik.

Mivel a gyalogok az első sorba is visszahelyezhetők, ezért erősebb védelem alakítható ki a király számára.

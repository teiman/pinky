

#include "../quakedef.h"
#include <windows.h>
#include <commctrl.h>
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <io.h>			// _open, etc
#include <direct.h>		// _mkdir
#include <conio.h>		// _putch
#include <tchar.h>
#include "../keys.h"
#include "../server.h"
#include <shlobj.h>

#include <windows.h>
#include <stdio.h>
#include <conio.h>
#include <tchar.h>

#define BUFSIZE 8192

int qbrain_connected = 0;
HANDLE qbrain_pipe = NULL;
LPTSTR qbrain_pipename = "\\\\.\\pipe\\qbrain";

static ddef_t * local_ED_FieldAtOfs (int ofs)
{
	ddef_t		*def;
	int			i;

	for (i = 0; i < qcvm->progs->numfielddefs; i++)
	{
		def = &qcvm->fielddefs[i];
		if (def->ofs == ofs)
			return def;
	}
	return NULL;
}

void qbridge_connect() {
	Con_Printf("[qbrain]  Connecting...\n");

	while (1)
	{
		qbrain_pipe = CreateFile(
			qbrain_pipename,   // pipe name
			GENERIC_READ |  // read and write access
			GENERIC_WRITE,
			0,              // no sharing
			NULL,           // default security attributes
			OPEN_EXISTING,  // opens existing pipe
			0,              // default attributes
			NULL);          // no template file

		// Break if the pipe handle is valid.
		if (qbrain_pipe != INVALID_HANDLE_VALUE)
			break;

		// Exit if an error other than ERROR_PIPE_BUSY occurs.
		if (GetLastError() != ERROR_PIPE_BUSY)
		{
			Con_Printf("[qbrain] Could not open pipe\n");
			return;
		}

		// <strike>All pipe instances are busy, so wait for 20 seconds. </strike>
		// All pipe instances are busy, so wait for 2 seconds.
		if (!WaitNamedPipe(qbrain_pipename, 2000))
		{
			Con_Printf("[qbrain] Could not open pipe: 2 second wait timed out.\n");
			qbrain_pipe = NULL;
			return;
		}
	}

	Con_Printf("[qbridge] Init Done.\n");
	return;
}

void qbridge_write(LPTSTR stringdata) {
	BOOL   fSuccess = FALSE;
	DWORD  cbToWrite, cbWritten;

	if (qbrain_pipe == NULL) {
		qbridge_connect();

		if (qbrain_pipe == NULL ) {
			Con_Printf("[qbrain]  Failed to open communication pipe.\n");
			return;
		}
	}

	cbToWrite = (lstrlen(stringdata)) * sizeof(TCHAR);

	fSuccess = WriteFile(
		qbrain_pipe,                  // pipe handle
		stringdata,             // message
		cbToWrite,              // message length
		&cbWritten,             // bytes written
		NULL					// not overlapped
	);

	if (!fSuccess)	{
		Con_Printf("[qbrain] WriteFile to pipe failed. GLE=%d\n", (int)GetLastError());
		qbrain_pipe = NULL; //flag for reconecction
	}
}

void qbridge_init() {
	Con_Printf("[qbrain]  Init....\n");

	LPTSTR messagedata = "{\"ok\":true,\"info\":\"data from the quake engine. 3\"}";

	qbridge_write(messagedata);
}


char* SerializeValue(etype_t type, eval_t* val)
{
	static char	line[256];
	ddef_t* def;
	dfunction_t* f;

	type = (etype_t)(type & ~DEF_SAVEGLOBAL);

	switch (type)
	{
	case ev_string:
		snprintf(line, sizeof(line), "%s", PR_GetString(val->string));
		break;
	case ev_entity:
		snprintf(line, sizeof(line), "%i", NUM_FOR_EDICT(PROG_TO_EDICT(val->edict)));
		break;
	case ev_function:
		f = qcvm->functions + val->function;
		snprintf(line, sizeof(line), "%s", PR_GetString(f->s_name));
		break;
	case ev_field:
		def = local_ED_FieldAtOfs(val->_int);
		snprintf(line, sizeof(line), "%s", PR_GetString(def->s_name));
		break;
	case ev_void:
		snprintf(line, sizeof(line), "void");
		break;
	case ev_float:
		snprintf(line, sizeof(line), "%.6g", val->_float);
		break;
	case ev_vector:
		snprintf(line, sizeof(line), "%.6g %.6g %.6g", val->vector[0], val->vector[1], val->vector[2]);
		break;
	default:
		snprintf(line, sizeof(line), "bad type %i", type);
		break;
	}

	return line;
}

char * qbridge_ED_Write(char* str, edict_t* ed, int id)
{
	ddef_t* d;
	int* v;
	int		i, j;
	char* name;
	int		type;
	char* f;

	f = str;

	f += sprintf(f, "{");

	f += sprintf(f, "\"id\":\"%d\",", id );

	if (ed->free){
		f += sprintf(f, "\"\":\"\"},\n");
		return f;
	}

	for (i = 1; i < qcvm->progs->numfielddefs; i++)
	{
		d = &qcvm->fielddefs[i];
		name = PR_GetString(d->s_name);
		if (name[strlen(name) - 2] == '_')
			continue;	// skip _x, _y, _z vars

		v = (int*)((char*)&ed->v + d->ofs * 4);

		// if the value is still all 0, skip the field
		type = d->type & ~DEF_SAVEGLOBAL;
		for (j = 0; j < type_size[type]; j++)
			if (v[j])
				break;
		if (j == type_size[type])
			continue;

		f += sprintf(f, "\"%s\":", name);
		f += sprintf(f, "\"%s\",", SerializeValue((etype_t)d->type, (eval_t*)v));
	}

	f += sprintf(f, "\"\":\"\"},\n");

	return f;
}



char qbrain_buff[8192 * 2000];

void qbridge_sendentities() {
	int i;

	char* p = qbrain_buff;

	p += sprintf(p, "{\"e\":[");

	for (i = 0; i < qcvm->num_edicts; i++) {
		p = qbridge_ED_Write(p, EDICT_NUM(i), i);
	}

	p += sprintf(p, "{}]}");
	p++;
	p[0] = 0;

	qbridge_write(qbrain_buff);
}
